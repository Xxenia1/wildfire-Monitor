// js/smoke_mode.js

const PROXY_BASE = "http://localhost:8787";
const CA_BBOX = [-125, 32, -113, 43.5];

let smokeLayerGroup = null;
let infoControl = null;
let legendControl = null;
let refreshTimer = null;

// ---------- AQI helpers ----------
function pm25ToAQI(pm) {
  const bp = [
    { cLo: 0.0,   cHi: 12.0,   iLo: 0,   iHi: 50  },
    { cLo: 12.1,  cHi: 35.4,   iLo: 51,  iHi: 100 },
    { cLo: 35.5,  cHi: 55.4,   iLo: 101, iHi: 150 },
    { cLo: 55.5,  cHi: 150.4,  iLo: 151, iHi: 200 },
    { cLo: 150.5, cHi: 250.4,  iLo: 201, iHi: 300 },
    { cLo: 250.5, cHi: 350.4,  iLo: 301, iHi: 400 },
    { cLo: 350.5, cHi: 500.4,  iLo: 401, iHi: 500 }
  ];
  const x = Math.max(0, Math.min(pm ?? 0, 500.4));
  const seg = bp.find(s => x >= s.cLo && x <= s.cHi) || bp[bp.length - 1];
  return Math.round(((seg.iHi - seg.iLo) / (seg.cHi - seg.cLo)) * (x - seg.cLo) + seg.iLo);
}
function getAqiColor(aqi) {
  if (aqi <= 50) return "#00e400";
  if (aqi <= 100) return "#ffff00";
  if (aqi <= 150) return "#ff7e00";
  if (aqi <= 200) return "#ff0000";
  if (aqi <= 300) return "#8f3f97";
  return "#7e0023";
}
function getCategoryName(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "USG";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}
function getRadius(aqi) {
  return Math.max(4, Math.min(14, 4 + aqi / 25));
}

// ---------- safe fetch (won't throw) ----------
async function fetchSmokeGeoJSON({ bbox = CA_BBOX, maxAgeMin, n } = {}) {
  try {
    const url = new URL(`${PROXY_BASE}/api/sensors/geojson`);
    url.searchParams.set("bbox", bbox.join(","));
    url.searchParams.set("location_type", "0"); // outdoor
    // stepwise enable to avoid 400 at first
    if (Number.isFinite(maxAgeMin)) url.searchParams.set("max_age", String(maxAgeMin));
    if (Number.isFinite(n)) url.searchParams.set("n", String(n));

    const resp = await fetch(url.toString(), { cache: "no-store" });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("smoke proxy error:", resp.status, text);
      return { type: "FeatureCollection", features: [] };
    }
    return await resp.json();
  } catch (e) {
    console.error("smoke fetch error:", e);
    return { type: "FeatureCollection", features: [] };
  }
}

// ---------- controls ----------
function buildInfoControl() {
  const ctrl = L.control({ position: "topright" });
  ctrl.onAdd = function () {
    this._div = L.DomUtil.create("div", "leaflet-bar");
    Object.assign(this._div.style, { background: "white", padding: "8px 10px", minWidth: "180px" });
    this.update();
    return this._div;
  };
  ctrl.update = function (stats) {
    if (!stats) {
      this._div.innerHTML = "<b>Smoke (PurpleAir)</b><br/><span style='color:#666'>Loading…</span>";
      return;
    }
    const { count, latestISO } = stats;
    this._div.innerHTML = `<b>Smoke (PurpleAir)</b><br/>Sensors: ${count}<br/>Latest: ${latestISO || "n/a"}`;
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
    Object.assign(div.style, { background: "white", padding: "8px 10px", lineHeight: "18px" });
    div.innerHTML = `<b>AQI (PM2.5)</b><br/>${labels.join("<br/>")}`;
    return div;
  };
  return ctrl;
}

// ---------- render ----------
function renderSmokeLayer(map, geojson) {
  if (smokeLayerGroup) {
    map.removeLayer(smokeLayerGroup);
    smokeLayerGroup = null;
  }

  const layer = L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => {
      const pm = feature?.properties?.pm2_5 ?? null;
      const aqi = pm != null ? pm25ToAQI(pm) : 0;
      const m = L.circleMarker(latlng, {
        radius: getRadius(aqi),
        color: "#444",
        weight: 0.8,
        fillColor: getAqiColor(aqi),
        fillOpacity: 0.85
      });
      const name = feature?.properties?.name || "Sensor";
      const last = feature?.properties?.last_seen ?? "n/a";
      m.bindPopup(`<div style="min-width:180px"><b>${name}</b><br/>PM2.5: ${pm ?? "n/a"} µg/m³<br/>AQI: ${aqi} (${getCategoryName(aqi)})<br/>Last: ${last}</div>`);
      return m;
    }
  });

  smokeLayerGroup = L.layerGroup([layer]).addTo(map);

  const count = geojson.features?.length || 0;
  let latestISO = null;
  for (const f of geojson.features || []) {
    const t = f.properties?.last_seen;
    if (t && (!latestISO || String(t) > String(latestISO))) latestISO = t;
  }
  infoControl && infoControl.update({ count, latestISO });
}

// ---------- public API ----------
export async function initSmokeMode(map, opts = {}) {
  if (!infoControl) { infoControl = buildInfoControl(); infoControl.addTo(map); }
  if (!legendControl) { legendControl = buildLegendControl(); legendControl.addTo(map); }

  const gj = await fetchSmokeGeoJSON(opts);   // minimal params first
  renderSmokeLayer(map, gj);

  const { refreshSec } = opts;
  if (refreshSec && Number(refreshSec) > 0) {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(async () => {
      const data = await fetchSmokeGeoJSON(opts);
      renderSmokeLayer(map, data);
    }, Number(refreshSec) * 1000);
  }
}

export function removeSmokeMode(map) {
  clearInterval(refreshTimer); refreshTimer = null;
  if (smokeLayerGroup) { map.removeLayer(smokeLayerGroup); smokeLayerGroup = null; }
  if (infoControl) { map.removeControl(infoControl); infoControl = null; }
  if (legendControl) { map.removeControl(legendControl); legendControl = null; }
}

// optional: stepwise enable stricter params
export async function refreshSmokeMode(map, opts = {}) {
  const gj = await fetchSmokeGeoJSON(opts);
  renderSmokeLayer(map, gj);
}
