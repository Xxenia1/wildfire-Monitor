// Turn AirNow hourly monitoring-site observations into the public map snapshot.
const CA_BBOX = [-125, 32, -113, 43.5];

function observedAt(row) {
  const raw = row.UTC ?? row.Utc ?? row.utc;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const text = raw.trim().replace(" ", "T");
  const iso = /(?:Z|[+-]\d\d:?\d\d)$/i.test(text) ? text : `${text}Z`;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function finiteValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isCaliforniaSite(siteId) {
  // AQS site IDs start with the two-digit state FIPS code, optionally after 840.
  // AirNow also reports temporary California monitors with MMCA IDs.
  return /^(?:840)?06/.test(siteId) || /^MMCA/i.test(siteId);
}

export function normalizeAirNow(rows, fetchedAt = new Date()) {
  if (!Array.isArray(rows)) throw new Error("AirNow response is not an array");
  const bySite = new Map();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const parameter = String(row.Parameter ?? row.ParameterName ?? "").toUpperCase();
    if (parameter && !/^PM\.?2\.?5$|^PM25$/.test(parameter)) continue;
    const lat = finiteValue(row.Latitude);
    const lon = finiteValue(row.Longitude);
    const aqi = finiteValue(row.AQI);
    const observed = observedAt(row);
    if (lat === null || lon === null || aqi === null || !observed) continue;
    if (lat < CA_BBOX[1] || lat > CA_BBOX[3] || lon < CA_BBOX[0] || lon > CA_BBOX[2] || aqi < 0 || aqi > 500) continue;
    const siteId = String(row.AQSID ?? row.FullAQSCode ?? `${lat},${lon}`);
    if (!isCaliforniaSite(siteId)) continue;
    const pm = finiteValue(row.RawConcentration);
    const feature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        site_id: siteId,
        site_name: String(row.SiteName ?? row.ReportingArea ?? "AirNow monitoring site"),
        aqi,
        pm2_5: pm !== null && pm >= 0 ? pm : null,
        observed_at_utc: observed,
      },
    };
    const previous = bySite.get(siteId);
    if (!previous || previous.properties.observed_at_utc < observed) bySite.set(siteId, feature);
  }
  const features = [...bySite.values()];
  if (!features.length) throw new Error("AirNow returned no valid recent PM2.5 observations; existing snapshot was preserved");
  const latest = features.reduce((max, feature) =>
    feature.properties.observed_at_utc > max ? feature.properties.observed_at_utc : max, "");
  return {
    type: "FeatureCollection",
    fetched_at_utc: fetchedAt.toISOString(),
    source_updated_at_utc: latest,
    source: "EPA AirNow",
    preliminary: true,
    features,
  };
}

export function buildAirNowUrl(key, now = new Date()) {
  if (!key) throw new Error("Missing AIRNOW_API_KEY secret");
  const end = new Date(now);
  end.setUTCMinutes(0, 0, 0);
  end.setUTCHours(end.getUTCHours() - 1);
  const start = new Date(end.getTime() - 3 * 60 * 60 * 1000);
  const format = date => date.toISOString().slice(0, 13);
  const url = new URL("https://www.airnowapi.org/aq/data/");
  for (const [name, value] of Object.entries({
    startDate: format(start), endDate: format(end), parameters: "PM25",
    BBOX: CA_BBOX.join(","), dataType: "A", format: "application/json",
    verbose: "1", monitorType: "0", includerawconcentration: "1", API_KEY: key,
  })) url.searchParams.set(name, value);
  return url;
}
