// Visualization of Fire Mode
// Fire mode = WFIGS perimeters (polygons) + FIRMS hotspots (points)

// --------- Constants and Tools ---------
const CA_BBOX = [-125, 32, -113, 43.5]; // [W,S,E,N]
const WFIGS_QUERY =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query";

// fetch perimeters polygon
function buildPerimeterUrl() {
  const p = new URLSearchParams({
    f: "geojson",
    where: "1=1",
    outFields: "*",
    outSR: "4326",
    geometry: CA_BBOX.join(","), // bbox filter CA
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects"
  });
  return `${WFIGS_QUERY}?${p.toString()}`;
}
// fetch FIRMS fire data
function getFirmsLatestUrl() {
  //const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  return "public/data/firms_ca_latest.geojson";
}
// fetch cal fire incidents latest geojson
function getCalfireUrl() {
  //const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  return 
     "public/data/calfire_incidents_latest.geojson";

}

const isNum = (n) => Number.isFinite(n);

// --------- WFIGS Style and Validation ---------
function perimStyle(feature) {
  const p = feature?.properties ?? {};
  const pct = p.percentcontained ?? p.poly_PercentContained ?? p.PERCENT_CONTAINED;
  const color = Number(pct) >= 70 ? "#2e7d32" : "#ff6d00"; // 70%↑ use green, otherwise orange
  return { color, weight: 2, fillOpacity: 0.1 };
}

function perimPopup(feature, layer) {
  const p = feature?.properties ?? {};
  const name =
    p.incidentname || p.poly_IncidentName || p.IncidentName || "Fire";
  const acres = p.gisacres ?? p.poly_GISAcres ?? p.GISAcres ?? "—";
  const pct =
    p.percentcontained ?? p.poly_PercentContained ?? p.PERCENT_CONTAINED ?? "—";
  const updated =
    p.irwinmodifiedondate || p.modifiedondate || p.CreateDate || p.poly_CreateDate || "—";

  layer.bindPopup(
    `<b>${name}</b><br/>Acres: ${acres}<br/>Contained: ${pct}%<br/>Updated: ${updated}`
  );
}

// Filter out those without valid coordinates Polygon/MultiPolygon
function validPerimeter(feature) {
  const g = feature?.geometry;
  if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return false;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.some(rings =>
    Array.isArray(rings) &&
    rings.some(ring =>
      Array.isArray(ring) &&
      ring.some(([x, y]) => isNum(x) && isNum(y))
    )
  );
}

// --------- FIRMS style & Validation ---------
function validFirmsPoint(f) {
  const g = f?.geometry;
  return g && g.type === "Point" &&
         Array.isArray(g.coordinates) &&
         isNum(g.coordinates[0]) && isNum(g.coordinates[1]);
}

function firmsMarker(feature, latlng) {
  const p = feature.properties ?? {};
  // confidence is optional, default to nominal
  let conf = p.confidence;
  conf = (typeof conf === 'number')
    ? conf
    : (/^\d+(\.\d+)?$/.test(String(conf)) ? Number(conf) : 50);

//   const frp = Number(p.frp);
//   const base = 6;
//   const confBoost = (Number(conf) || 50) / 25;
//   const frpBoost  = Number.isFinite(frp) ? Math.min(8, Math.sqrt(Math.max(0, frp))) : 0;
//   const r = Math.max(6, Math.min(18, base + confBoost + frpBoost));

//   // main point style
//   const core = L.circleMarker(latlng, {
//     radius: r,
//     color: "#ffffff",     // 白边
//     weight: 1,
//     fillColor: "#e53935", // 红
//     fillOpacity: 0.85,
//   });

//   // 组合成一个点层
//   return L.layerGroup([halo, core]);
// }
  const r = isNum(conf) ? Math.max(3, Math.min(7, Math.round(conf / 10))) : 4;

  return L.circleMarker(latlng, {
    radius: r,
    color: "#b71c1c",
    weight: 1,
    fillColor: "#e53935",
    fillOpacity: 0.8
  });
}
function fmtTimes(acq_date, acq_time) {
  if (!acq_date || acq_time == null) return { local: "—", utc: "—" };
  const t = String(acq_time).padStart(4, "0"); // '0932'
  const h = Number(t.slice(0, 2)), m = Number(t.slice(2, 4));
  const iso = `${acq_date}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00Z`;
  const d = new Date(iso);
  const local = new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(d);
  const utc = new Intl.DateTimeFormat("en-GB", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC"
  }).format(d) + " UTC";
  return { local, utc };
}
function viirsConfidenceTag(conf) {
  let label = "Unknown", cls = "badge-unk";
  if (typeof conf === "string") {
    const c = conf.trim().toLowerCase();
    if (c === "h") { label = "High"; cls = "badge-high"; }
    else if (c === "n") { label = "Nominal"; cls = "badge-nom"; }
    else if (c === "l") { label = "Low"; cls = "badge-low"; }
  } else if (typeof conf === "number") {
    label = `${conf}/100`;
    if (conf >= 80) cls = "badge-high";
    else if (conf >= 50) cls = "badge-nom";
    else cls = "badge-low";
  }
  return { label, cls };
}
function frpLevel(frp) {
  const v = Number(frp);
  if (!Number.isFinite(v)) return { label: "—", hint: "" };
  if (v >= 15) return { label: "High", hint: "(strong fire energy)" };
  if (v >= 5)  return { label: "Moderate", hint: "" };
  if (v >= 1)  return { label: "Low", hint: "" };
  return { label: "Very low", hint: "" };
}

function satName(s) {
  const c = String(s || "").toUpperCase();
  if (c === "J") return "Suomi-NPP (VIIRS)";
  if (c === "N") return "NOAA-20 (VIIRS)";
  if (c === "A") return "NOAA-21 (VIIRS)";
  return "VIIRS";
}
function firmsPopup(feature, layer) {
  const p = feature.properties ?? {};

  const { local, utc } = fmtTimes(p.acq_date, p.acq_time);
  const conf = viirsConfidenceTag(p.confidence);
  const frp   = Number.isFinite(Number(p.frp)) ? Number(p.frp) : null;
  const frpCat = frpLevel(frp);
  const bright = Number.isFinite(Number(p.bright_ti4)) ? Number(p.bright_ti4) : null;
  const sat = satName(p.satellite);
  const daynight = (p.daynight === "D" ? "Day (sunlit)" : p.daynight === "N" ? "Night" : "—");

  const html = `
    <div class="hotspot-popup">
      <h4>🔥 VIIRS Hotspot</h4>
      <div class="sub">A thermal anomaly detected from space (point ≠ fire edge)</div>

      <div class="kv">
        <div class="k">Detected (local)</div><div class="v">${local}</div>
        <div class="k">Detected (UTC)</div>  <div class="v">${utc}</div>

        <div class="k">Confidence</div>
        <div class="v"><span class="badge ${conf.cls}" title="VIIRS confidence">${conf.label}</span></div>

        <div class="k">FRP</div>
        <div class="v">${frp ?? "—"} MW <span class="muted">${frpCat.label} ${frpCat.hint}</span></div>

        <div class="k">Brightness (I4)</div>
        <div class="v">${bright ?? "—"} K <span class="muted" title="Channel I4 (~3.7μm) brightness temperature — higher ≈ hotter surface">brightness temperature</span></div>

        <div class="k">Satellite</div><div class="v">${sat}</div>
        <div class="k">Day/Night</div><div class="v">${daynight}</div>
      </div>

      <div class="foot">Note: Hotspots are 375 m VIIRS pixels; locations are approximate. FRP ≈ fire energy; higher means stronger fire activity.</div>
    </div>
  `;
  layer.bindPopup(html);
}

// --------- CAL FIRE style & popup ---------
function calfireStyle(feature) {
  const p = feature?.properties ?? {};
  const pct = Number(p.PercentContained ?? p.percentcontained ?? p.PERCENT_CONTAINED);
  const status = String(p.Status ?? p.IncidentStatus ?? "").toLowerCase();

  const color =
    Number.isFinite(pct) && pct >= 70
      ? "#2e7d32"                          // 70%+ 绿色
      : (status.includes("active") || status.includes("new"))
      ? "#e65100"                          // 活动态/新起火 橙色
      : "#6d4c41";                         // 其他 棕色

  const isPoly = feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon";
  return { color, weight: isPoly ? 2 : 1.5, fillOpacity: isPoly ? 0.15 : 1 };
}

function calfirePopup(feature, layer) {
  const p = feature?.properties ?? {};
  const name    = p.Name || p.IncidentName || "Incident";
  const county  = p.County || p.CaliforniaCounty || "—";
  const acres   = p.AcresBurned ?? p.GISAcres ?? p.DailyAcres ?? p.acres ?? "—";
  const pct     = p.PercentContained ?? p.percentcontained ?? "—";
  const started = p.Started ?? p.StartDate ?? p.StartDateTime ?? "—";
  const updated = p.Updated ?? p.ModifiedOnDate ?? p.UpdateDate ?? "—";
  const status  = p.Status ?? p.IncidentStatus ?? (p.IsActive ? "Active" : "—");
  const cause   = p.Cause ?? p.cause ?? "";
  const url     = p.Url || p.URL || p.IncidentURL || "";

  const html = `
    <div class="calfire-popup">
      <h4>🚒 CAL FIRE Incident</h4>
      <div class="kv">
        <div class="k">Incident</div><div class="v">${name}</div>
        <div class="k">County</div><div class="v">${county}</div>
        <div class="k">Area</div><div class="v">${acres} acres</div>
        <div class="k">Contained</div><div class="v">${pct}%</div>
        <div class="k">Started</div><div class="v">${started}</div>
        <div class="k">Updated</div><div class="v">${updated}</div>
        <div class="k">Status</div><div class="v">${status}</div>
        ${cause ? `<div class="k">Cause</div><div class="v">${cause}</div>` : ""}
        ${url ? `<div class="k">Official</div><div class="v"><a href="${url}" target="_blank" rel="noopener">Incident page</a></div>` : ""}
      </div>
      <div class="note">State-level incident records (last 24h).</div>
    </div>
  `;
  layer.bindPopup(html);
}

// --------- Internal State ---------
let _group = null;        // group layer
let _perimLayer = null;   // WFIGS layer
let _firmsLayer = null;   // FIRMS layer
let _calfireLayer = null; // CAL FIRE layer
let _refreshTimer = null; // refresh timer

// --------- Legend Control ---------
let _fireLegend = null;

function createFireLegend() {
  const Legend = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function () {
      const div = L.DomUtil.create('div', 'legend fire-legend');
      div.innerHTML = `
        <div class="legend-title">Fire Layers</div>

        <div class="legend-row">
          <span class="swatch line orange"></span>
          <span>WFIGS Perimeter < 70% contained</span>
        </div>
        <div class="legend-row">
          <span class="swatch line green"></span>
          <span>WFIGS Perimeter ≥ 70% contained</span>
        </div>

        <div class="legend-row">
          <span class="swatch dot red"></span>
          <span>FIRMS hotspot <em>(size ≈ confidence)</em></span>
        </div>

        <div class="legend-row">
          <span class="swatch dot brown"></span>
          <span>CAL FIRE incident (point)</span>
        </div>
        <div class="legend-row">
          <span class="swatch line brown"></span>
          <span>CAL FIRE incident perimeter</span>
        </div>
      `;
      // Prevent dragging/scrolling the legend from affecting the map
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      return div;
    }
  });
  return new Legend();
}

function addFireLegend(map) {
  if (!_fireLegend) _fireLegend = createFireLegend();
  _fireLegend.addTo(map);
}

function removeFireLegend(map) {
  if (_fireLegend) {
    map.removeControl(_fireLegend);
    _fireLegend = null;
  }
}

// --------- Outer API ---------
export async function enableFire() {
  const map = window.map;
  if (!map) throw new Error("Map not found: make sure window.map is set.");

  // If it has already been created, just add it back
  if (_group) { _group.addTo(map); return _group; }

  _group = L.layerGroup().addTo(map);

  // 1) Loading WFIGS perimeters
  try {
    const perimGeo = await fetch(buildPerimeterUrl()).then(r => r.json());
    _perimLayer = L.geoJSON(perimGeo, {
      filter: validPerimeter,
      style: perimStyle,
      onEachFeature: perimPopup
    }).addTo(_group);
  } catch (e) {
    console.warn("WFIGS perimeters load failed:", e);
  }

  // 2) Loading FIRMS hotspots
  try {
    const firmsGeo = await fetch(getFirmsLatestUrl(), { cache: "no-cache" }).then(r => r.json());
    _firmsLayer = L.geoJSON(firmsGeo, {
      filter: validFirmsPoint,
      pointToLayer: firmsMarker,
      onEachFeature: firmsPopup
    }).addTo(_group);
  } catch (e) {
    console.warn("FIRMS hotspots load failed:", e);
  }

  //  Loading CAL FIRE incidents (today / last 24h)
  try {
    const calGeo = await fetch(getCalfireUrl(), { cache: "no-cache" }).then(r => r.json());
    _calfireLayer = L.geoJSON(calGeo, {
      pointToLayer: (feat, latlng) => L.circleMarker(latlng, {
        radius: 10,
        color: "#6d4c41",
        weight: 1,
        fillColor: "#8d6e63",
        fillOpacity: 0.9
      }),
      style: calfireStyle,
      onEachFeature: calfirePopup
    }).addTo(_group);
  } catch (e) {
    console.warn("CAL FIRE incidents load failed:", e);
  }

  // 3) refresh：WFIGS 90min、FIRMS 30min；Unified 60min simplified
  clearInterval(_refreshTimer);
  _refreshTimer = setInterval(async () => {
    try {
      if (_perimLayer) {
        const freshPerim = await fetch(buildPerimeterUrl()).then(r => r.json());
        _perimLayer.clearLayers(); _perimLayer.addData(freshPerim);
      }
      if (_firmsLayer) {
        const freshFirms = await fetch(getFirmsLatestUrl(), { cache: "no-cache" }).then(r => r.json());
        _firmsLayer.clearLayers(); _firmsLayer.addData(freshFirms);
      }
      if (_calfireLayer) {
        const freshCal = await fetch(getCalfireUrl(), { cache: "no-cache" }).then(r => r.json());
        _calfireLayer.clearLayers(); _calfireLayer.addData(freshCal);
      }
    } catch (e) {
      console.warn("Fire mode refresh failed:", e);
    }
  }, 60 * 60 * 1000);

  addFireLegend(map);
  return _group;
}

export function disableFire() {
  const map = window.map;
  if (_group && map) map.removeLayer(_group);
  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
  removeFireLegend(map);
}

