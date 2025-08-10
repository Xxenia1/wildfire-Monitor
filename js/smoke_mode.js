// js/smoke_mode.js

const PROXY_BASE = "http://localhost:8787";
const CA_BBOX = [-125, 32, -113, 43.5]; // [W,S,E,N]

let smokeLayerGroup = null;
let infoControl = null;
let legendControl = null;
let refreshTimer = null;

/** ---------- AQI helpers (EPA 24-hr PM2.5) ---------- */
function pm25ToAQI(pm) {
  // Truncated to 0-500 range; use EPA breakpoints
  const bp = [
    { cLo: 0.0, cHi: 12.0, iLo: 0,   iHi: 50  },
    { cLo: 12.1, cHi: 35.4, iLo: 51, iHi: 100 },
    { cLo: 35.5, cHi: 55.4, iLo: 101,iHi: 150 },
    { cLo: 55.5, cHi: 150.4,iLo: 151,iHi: 200 },
    { cLo: 150.5,cHi: 250.4,iLo: 201,iHi: 300 },
    { cLo: 250.5,cHi: 350.4,iLo: 301,iHi: 400 },
    { cLo: 350.5,cHi: 500.4,iLo: 401,iHi: 500 }
  ];
  const x = Math.max(0, Math.min(pm ?? 0, 500.4));
  const seg = bp.find(s => x >= s.cLo && x <= s.cHi) || bp[bp.length - 1];
  const aqi = ((seg.iHi - seg.iLo) / (seg.cHi - seg.cLo)) * (x - seg.cLo) + seg.iLo;
  return Math.round(aqi);
}

function getAqiColor(aqi) {
  if (aqi <= 50) return "#00e400";
  if (aqi <= 100) return "#ffff00";
  if (aqi <= 150) return "#ff7e00";
  if (aqi <= 200) return "#ff0000";
  if (aqi <= 300) return "#8f3f97";
  if (aqi <= 500) return "#7e0023";
  return "#7e0023";
}

function getCategoryName(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for SG";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

function getRadius(aqi) {
  // Scales gently with AQI; clamp 4–14 px
  const r = 4 + (aqi / 25);
  return Math.max(4, Math.min(14, r));
}

/** ---------- Fetch via proxy ---------- */
async function fetchSmokeGeoJSON({ bbox = CA_BBOX, maxAgeMin = 60, n = 1000, cacheTtl = 30 } = {}) {
  const url = new URL(`${PROXY_BASE}/api/sensors/geojson`);
  url.searchParams.set("bbox", bbox.join(","));
  url.searchParams.set("location_type", "0"); // outdoor
  url.searchParams.set("max_age", String(maxAgeMin));
  url.searchParams.set("n", String(n));
  url.searchParams.set("cache_ttl", String(cacheTtl));
  // fields default set by proxy; you can override by adding url.searchParams.set("fields", "...")

  const resp = await fetch(url.toString(), { cache: "no-store" });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

/** ---------- Controls ---------- */
function buildInfoControl() {
  const ctrl = L.control({ position: "topright" });
  ctrl.onAdd = function () {
    this._div = L.DomUtil.create("div", "leaflet-bar");
    this._div.style.background = "white";
    this._div.style.padding = "8px 10px";
    this._div.style.minWidth = "180px";
    this.update();
    return this._div;
  };
  ctrl.update = function (stats) {
    if (!stats) {
      this._div.innerHTML = "<b>Smoke (PurpleAir)</b><br/><span style='color:#666'>Loading…</span>";
      return;
    }
    const { count, latestISO } = stats;
    this._div.innerHTML = `
      <b>Smoke (PurpleAir)</b><br/>
      Sensors: ${count}<br/>
      Latest: ${latestISO || "n/a"}
    `;
  };
  return ctrl;
}

function buildLegendControl() {
  const grades = [0, 51, 101, 151, 201, 301];
  const labels = grades.map((g, i) => {
    const from = g;
    const to = grades[i + 1] ? grades[i + 1] - 1 : 500;
    const color = getAqiColor(from === 0 ? 0 : from);
    return `<i style="background:${color};width:12px;height:12px;display:inline-block;margin-right:6px;border:1px solid #888;"></i>${from}–${to}`;
  });

  const ctrl = L.control({ position: "bottomright" });
  ctrl.onAdd = function () {
    const div = L.DomUtil.create("div", "leaflet-bar");
    div.style.background = "white";
    div.style.padding = "8px 10px";
    div.style.lineHeight = "18px";
    div.innerHTML = `<b>AQI (PM2.5)</b><br/>${labels.join("<br/>")}`;
    return div;
  };
  return ctrl;
}

/** ---------- Render ---------- */
function renderSmokeLayer(map, geojson) {
  if (smokeLayerGroup) {
    map.removeLayer(smokeLayerGroup);
    smokeLayerGroup = null;
  }

  const layer = L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => {
      const pm = feature?.properties?.pm2_5 ?? null;
      const aqi = pm != null ? pm25ToAQI(pm) : 0;
      const marker = L.circleMarker(latlng, {
        radius: getRadius(aqi),
        color: "#444",
        weight: 0.8,
        fillColor: getAqiColor(aqi),
        fillOpacity: 0.85
      });
      const name = feature?.properties?.name || "Sensor";
      const last = feature?.properties?.last_seen ?? "n/a";
      marker.bindPopup(`
        <div style="min-width:180px">
          <b>${name}</b><br/>
          PM2.5: ${pm ?? "n/a"} µg/m³<br/>
          AQI: ${aqi} (${getCategoryName(aqi)})<br/>
          Last seen: ${last}
        </div>
      `);
      return marker;
    }
  });

  smokeLayerGroup = L.layerGroup([layer]).addTo(map);

  // stats for infoControl
  const count = geojson.features?.length || 0;
  let latestISO = null;
  for (const f of geojson.features || []) {
    const t = f.properties?.last_seen;
    if (t && (!latestISO || String(t) > String(latestISO))) latestISO = t;
  }
  infoControl && infoControl.update({ count, latestISO });
}

/** ---------- Public API ---------- */
export async function initSmokeMode(map, opts = {}) {
  // controls (create once)
  if (!infoControl) {
    infoControl = buildInfoControl();
    infoControl.addTo(map);
  }
  if (!legendControl) {
    legendControl = buildLegendControl();
    legendControl.addTo(map);
  }

  // first load
  const geo = await fetchSmokeGeoJSON(opts);
  renderSmokeLayer(map, geo);

  // optional auto refresh
  const { refreshSec } = opts;
  if (refreshSec && Number(refreshSec) > 0) {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(async () => {
      try {
        const gj = await fetchSmokeGeoJSON(opts);
        renderSmokeLayer(map, gj);
      } catch (e) {
        console.error("smoke refresh error:", e);
      }
    }, Number(refreshSec) * 1000);
  }

  return smokeLayerGroup;
}

export function removeSmokeMode(map) {
  clearInterval(refreshTimer);
  refreshTimer = null;
  if (smokeLayerGroup) {
    map.removeLayer(smokeLayerGroup);
    smokeLayerGroup = null;
  }
  if (infoControl) {
    map.removeControl(infoControl);
    infoControl = null;
  }
  if (legendControl) {
    map.removeControl(legendControl);
    legendControl = null;
  }
}

/** Convenience single-shot updater */
export async function refreshSmokeMode(map, opts = {}) {
  const gj = await fetchSmokeGeoJSON(opts);
  renderSmokeLayer(map, gj);
}
