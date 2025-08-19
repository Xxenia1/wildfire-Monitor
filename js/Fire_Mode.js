// ========================== Fire_Mode.js (merged: old WFIGS + new UI + fixed CAL FIRE popups) ==========================
// Fire = WFIGS perimeters (polygons) + FIRMS hotspots (points) + CAL FIRE incidents

// --------- Basic tools ---------
function assetUrl(relPath) {
  const base = document.baseURI || window.location.href;
  const p = String(relPath || "").replace(/^\/+/, "");
  return new URL(p, base).toString();
}

// fetch：沿用“旧版”做法（仅 no-store），避免跨域被 same-origin 限制
async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  const rc  = res.clone();
  if (!res.ok) {
    const text = await rc.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}\n${text.slice(0,200)}`);
  }
  try {
    return await res.json();
  } catch (e) {
    const text = await rc.text().catch(() => "");
    throw new Error(`Invalid JSON from ${url}\n${text.slice(0,200)}`);
  }
}

// --------- Constants ---------
const CA_BBOX = [-125, 32, -113, 43.5]; // [W,S,E,N]
const WFIGS_QUERY =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query";

// 你的本地数据路径固定在 public/data/
const FIRMS_URL   = assetUrl("public/data/firms_ca_latest.geojson");
const CALFIRE_URL = assetUrl("public/data/calfire_incidents_latest.geojson");

function buildPerimeterUrl() {
  const p = new URLSearchParams({
    f: "geojson",
    where: "1=1",
    outFields: "*",
    outSR: "4326",
    geometry: CA_BBOX.join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects"
  });
  return `${WFIGS_QUERY}?${p.toString()}`;
}

const COLOR = {
  danger: "#e53935",
  warn:   "#ff6d00",
  ok:     "#2e7d32",
  brown:  "#6d4c41",
  brownFill: "#8d6e63"
};
const isNum = (n) => Number.isFinite(n);

// ---- Progression (FIRMS daily) quick overlay ----
const PROG_LAST_N_DAYS = 7;        // 显示最近 N 天
const PROG_SEARCH_RADIUS_KM = 60;  // 只取离所选火场中心 60km 内的点，避免全州混入
const PROG_CIRCLE_RADIUS_M = 350;  // 每个热点画 350m 的圆，叠出“蔓延面”的感觉
const PROG_COLORS = [              // 天数不够会循环
  "#2563eb","#22c55e","#eab308","#f97316","#ef4444",
  "#8b5cf6","#14b8a6","#84cc16","#f59e0b","#fb7185"
];

// 可选：把普通 FIRMS 点也放大（你说太小）
const FIRMS_RADIUS_MIN = 7;
const FIRMS_RADIUS_MAX = 13;
const FIRMS_RADIUS_BASE = 3;

// --------- Containment gradient (0% red → 50% orange → 100% green) ---------
function containmentColor(pct) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  const lerp = (a,b,t)=> Math.round(a + (b-a)*t);
  let r,g,b;
  if (v <= 50) { // red -> orange
    const t = v/50;
    r = 229; g = lerp(57, 206, t); b = lerp(53, 0, t);
  } else {      // orange -> green
    const t = (v-50)/50;
    r = lerp(255, 46, t); g = lerp(109,125, t); b = 0;
  }
  return `rgb(${r},${g},${b})`;
}

// ======================= WFIGS =======================
function perimStyle(feature) {
  const p = feature?.properties ?? {};
  const pct = p.percentcontained ?? p.poly_PercentContained ?? p.PERCENT_CONTAINED ?? 0;
  const color = containmentColor(pct);
  return { color, weight: 2, fillColor: color, fillOpacity: 0.08, pane: "perimPane" };
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

  const pctNum = Number(pct);
  const badgeCls = Number.isFinite(pctNum)
    ? (pctNum>=70 ? "badge-high" : (pctNum>=30 ? "badge-mid" : "badge-low"))
    : "badge-unk";

  layer.bindPopup(
    `<div class="panel popup-perim">
       <h4>🧭 WFIGS Perimeter</h4>
       <div class="kv">
         <div class="k">Incident</div><div class="v">${name}</div>
         <div class="k">Acres</div><div class="v">${acres}</div>
         <div class="k">Contained</div><div class="v"><span class="badge ${badgeCls}">${pct}%</span></div>
         <div class="k">Updated</div><div class="v">${updated}</div>
       </div>
       <div class="note">Perimeter color = containment% (gradient).</div>
       <div class="ops" style="margin-top:8px">
        <button class="btn btn-primary" id="btn-prog-show">
          Show the spread of the last${PROG_LAST_N_DAYS}days (FIRMS approximation)
        </button>
        <button class="btn" id="btn-prog-hide">Hidden Spread</button>
      </div>
     </div>`
  );
  //bind events for btns
  layer.on("popupopen", (e) => {
  const root = e.popup.getElement();
  const btnShow = root.querySelector("#btn-prog-show");
  const btnHide = root.querySelector("#btn-prog-hide");

  btnShow?.addEventListener(
    "click",
    (ev) => {
      ev.preventDefault();
      ev.stopPropagation();            // 防止点按钮触发地图点击
      showFirmsProgressionForPerimeter(feature, PROG_LAST_N_DAYS);
    },
    { once: true }                      // 同一弹窗只绑一次
  );

  btnHide?.addEventListener(
    "click",
    (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      removeFirmsProgression(window.map);
    },
    { once: true }
  );
});
}

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

// ======================= FIRMS =======================
function validFirmsPoint(f) {
  const g = f?.geometry;
  return g && g.type === "Point" &&
         Array.isArray(g.coordinates) &&
         isNum(g.coordinates[0]) && isNum(g.coordinates[1]);
}

function firmsMarker(feature, latlng) {
  const p = feature.properties ?? {};
  let conf = p.confidence;
  conf = (typeof conf === 'number')
    ? conf
    : (/^\d+(\.\d+)?$/.test(String(conf)) ? Number(conf) : 50);

  const r = Number.isFinite(conf)
  ? Math.max(FIRMS_RADIUS_MIN, Math.min(FIRMS_RADIUS_MAX, FIRMS_RADIUS_BASE + Math.round(conf / 5)))
  : Math.round((FIRMS_RADIUS_MIN + FIRMS_RADIUS_MAX) / 2);

  return L.circleMarker(latlng, {
    radius: r,
    color: "#ffffff",
    weight: 1,
    fillColor: COLOR.danger,
    fillOpacity: 0.9,
    pane: "firmsPane"
  });
}

function fmtTimes(acq_date, acq_time) {
  if (!acq_date || acq_time == null) return { local: "—", utc: "—" };
  const t = String(acq_time).padStart(4, "0");
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
    else if (c === "n") { label = "Nominal"; cls = "badge-mid"; }
    else if (c === "l") { label = "Low"; cls = "badge-low"; }
  } else if (typeof conf === "number") {
    label = `${conf}/100`;
    if (conf >= 80) cls = "badge-high";
    else if (conf >= 50) cls = "badge-mid";
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
    <div class="panel hotspot-popup">
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
        <div class="v">${bright ?? "—"} K <span class="muted">brightness temperature</span></div>
        <div class="k">Satellite</div><div class="v">${sat}</div>
        <div class="k">Day/Night</div><div class="v">${daynight}</div>
      </div>
      <div class="note">Hotspots are 375 m VIIRS pixels; FRP ≈ fire energy.</div>
    </div>
  `;
  layer.bindPopup(html);
}

// ======================= CAL FIRE (fixed point popups) ======================
function calfirePopupHtml(p = {}) {
  const name    = p.Name || p.IncidentName || "Incident";
  const county  = p.County || p.CaliforniaCounty || "—";
  const acres   = p.AcresBurned ?? p.GISAcres ?? p.DailyAcres ?? p.acres ?? "—";
  const pct     = p.PercentContained ?? p.percentcontained ?? "—";
  const started = p.Started ?? p.StartDate ?? p.StartDateTime ?? "—";
  const updated = p.Updated ?? p.ModifiedOnDate ?? p.UpdateDate ?? "—";
  const status  = p.Status ?? p.IncidentStatus ?? (p.IsActive ? "Active" : "—");
  const cause   = p.Cause ?? p.cause ?? "";
  const url     = p.Url || p.URL || p.IncidentURL || "";

  return `
    <div class="panel calfire-popup">
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
}

function calfirePoint(latlng, feature) {
  // 可视 🔥 图标（DivIcon）
  const pin = L.marker(latlng, {
    icon: L.divIcon({
      className: "calfire-icon leaflet-interactive",
      html: `<div class="calfire-pin">🔥</div>`,
      iconSize: [22, 22],       // 稍微放大 20→22
      iconAnchor: [11, 11],
      popupAnchor: [0, -12]
    }),
    pane: "calfirePane",
    interactive: true,
    riseOnHover: true,
    zIndexOffset: 500
  });


  // “隐形命中圈”（只负责扩大可点击区域；完全透明）
  const hit = L.circleMarker(latlng, {
    radius: 14,                 // 命中半径（像素），可按需调大，比如 16
    color: "transparent",
    fillColor: "transparent",
    fillOpacity: 0,
    opacity: 0,
    pane: "calfirePane",
    interactive: true,          // 重要：让这个圈能接收事件
    bubblingMouseEvents: true
  });

  // 用 featureGroup 承载 popup —— 点击圈或图标都能触发
  const group = L.featureGroup([hit, pin]);
  group.bindPopup(calfirePopupHtml(feature?.properties || {}));

  // 保险：显式在点击时打开（有些自定义样式会影响默认行为）
   group.on("click", (e) => group.openPopup(e.latlng));

  // 把 GeoJSON 的 feature 挂回去，方便后续过滤/侧栏读取属性
  group.feature = feature;

  return group;
}
function calfireStyle(feature) {
  const p = feature?.properties ?? {};
  const pct = Number(p.PercentContained ?? p.percentcontained ?? p.PERCENT_CONTAINED);
  const status = String(p.Status ?? p.IncidentStatus ?? "").toLowerCase();

  const col = Number.isFinite(pct)
    ? containmentColor(pct)
    : (status.includes("active") || status.includes("new")) ? COLOR.warn : COLOR.brown;

  const isPoly = feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon";
  return { color: col, weight: isPoly ? 2 : 1.5, fillOpacity: isPoly ? 0.12 : 1, pane: "calfirePane" };
}

function calfireOnEach(feature, layer) {
  if (feature.geometry?.type !== "Point") {
    layer.bindPopup(calfirePopupHtml(feature.properties || {}));
  }
}

// ======================= Filters / Sidebar / Legend =======================
const fireFilters = { firmsTime: "24h", contain: "all", size: "all" };

function sizeBucket(acres) {
  const v = Number(acres);
  if (!Number.isFinite(v)) return "all";
  if (v >= 5000) return "large";
  if (v >= 500)  return "medium";
  return "small";
}

let _fireLegend = null;
let _fireFilterCtl = null;
let _fireListCtl = null;
let _fireListEl  = null;

function createFireLegend() {
  const Legend = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function () {
      const div = L.DomUtil.create('div', 'panel legend fire-legend');
      div.innerHTML = `
        <div class="panel-title">Fire Layers</div>
        <div class="legend-row">
          <span class="swatch line" style="--c:#e53935"></span>
          <span>WFIGS/CAL FIRE Perimeter (color = containment%)</span>
        </div>
        <div class="gradient">
          <span>0%</span><div class="bar"></div><span>100%</span>
        </div>
        <div class="legend-row">
          <span class="swatch dot red"></span>
          <span>FIRMS Hotspot (size ≈ confidence)</span>
        </div>
        <div class="legend-row">
          <span class="swatch icon">🔥</span>
          <span>CAL FIRE Incident</span>
        </div>
      `;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      return div;
    }
  });
  return new Legend();
}
function addFireLegend(map){ if (!_fireLegend) _fireLegend = createFireLegend(); _fireLegend.addTo(map); }
function removeFireLegend(map){ if (_fireLegend) { map.removeControl(_fireLegend); _fireLegend = null; } }

function ensureFireSubFilters(map) {
  if (_fireFilterCtl) return;
  const Ctl = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function() {
      const div = L.DomUtil.create('div', 'panel fire-filters');
      div.innerHTML = `
        <div class="panel-title">Fire Filters</div>
        <label class="row">
          <span>FIRMS Time</span>
          <select id="ff-time">
            <option value="24h">Past 24h</option>
            <option value="7d">Past 7 days</option>
            <option value="all">All</option>
          </select>
        </label>
        <label class="row">
          <span>Containment</span>
          <select id="ff-contain">
            <option value="all">All</option>
            <option value="lt70">&lt; 70%</option>
            <option value="gte70">≥ 70%</option>
          </select>
        </label>
        <label class="row">
          <span>Size</span>
          <select id="ff-size">
            <option value="all">All</option>
            <option value="small">Small (&lt;500)</option>
            <option value="medium">Medium (500–5000)</option>
            <option value="large">Large (≥5000)</option>
          </select>
        </label>
      `;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);

      const timeSel = div.querySelector('#ff-time');
      const conSel  = div.querySelector('#ff-contain');
      const sizeSel = div.querySelector('#ff-size');

      const apply = () => {
        fireFilters.firmsTime = timeSel.value;
        fireFilters.contain   = conSel.value;
        fireFilters.size      = sizeSel.value;
        applyFireFilters();
      };

      timeSel.value = fireFilters.firmsTime;
      conSel.value  = fireFilters.contain;
      sizeSel.value = fireFilters.size;

      timeSel.addEventListener('change', apply);
      conSel.addEventListener('change', apply);
      sizeSel.addEventListener('change', apply);

      return div;
    }
  });
  _fireFilterCtl = new Ctl().addTo(map);
}

function ensureFireSidebar(map) {
  if (_fireListCtl) return;
  const Sidebar = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function() {
      const div = L.DomUtil.create('div', 'panel fire-list');
      div.innerHTML = `
        <div class="panel-title">Top 5 Major Fires</div>
        <div class="sub">Sorted by uncontrolled area (dynamic)</div>
        <div class="list" id="fire-list-items"></div>
      `;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      _fireListEl = div.querySelector('#fire-list-items');
      return div;
    }
  });
  _fireListCtl = new Sidebar().addTo(map);
}

function rebuildFireList() {
  if (!_fireListEl) return;
  const items = [];

  if (_calfireLayer) {
    _calfireLayer.eachLayer(l => {
      const f = l.feature; if (!f) return;
      const p = f.properties||{};
      const acres = Number(p.AcresBurned ?? p.GISAcres ?? p.DailyAcres ?? p.acres);
      const pct   = Number(p.PercentContained ?? p.percentcontained ?? p.PERCENT_CONTAINED) || 0;
      const uncontained = Number.isFinite(acres) ? acres * (1 - Math.min(1, Math.max(0, pct/100))) : 0;
      const name = p.Name || p.IncidentName || "Incident";
      const center = getFeatureCenter(f);
      items.push({ name, acres, pct, uncontained, center });
    });
  }

  if (_perimLayer) {
    _perimLayer.eachLayer(l => {
      const f = l.feature; if (!f) return;
      const p = f.properties||{};
      const acres = Number(p.gisacres ?? p.poly_GISAcres ?? p.GISAcres);
      const pct   = Number(p.percentcontained ?? p.poly_PercentContained ?? p.PERCENT_CONTAINED) || 0;
      const uncontained = Number.isFinite(acres) ? acres * (1 - Math.min(1, Math.max(0, pct/100))) : 0;
      const name = p.incidentname || p.poly_IncidentName || p.IncidentName || "Fire";
      const center = getFeatureCenter(f);
      items.push({ name, acres, pct, uncontained, center });
    });
  }

  items.sort((a,b)=> (b.uncontained||0) - (a.uncontained||0));
  const top = items.slice(0,5);

  _fireListEl.innerHTML = top.map(it => {
    const pctLbl = Number.isFinite(it.pct) ? `${Math.round(it.pct)}%` : "—";
    const acresLbl = Number.isFinite(it.acres) ? `${Math.round(it.acres).toLocaleString()} ac` : "—";
    const badgeCls = Number.isFinite(it.pct) ? (it.pct>=70 ? "badge-high" : (it.pct>=30 ? "badge-mid" : "badge-low")) : "badge-unk";
    return `
      <div class="card fire-item" data-center='${JSON.stringify(it.center)}'>
        <div class="title">${it.name}</div>
        <div class="meta">
          <span class="chip">${acresLbl}</span>
          <span class="chip ${badgeCls}">${pctLbl}</span>
        </div>
      </div>
    `;
  }).join("");

  _fireListEl.querySelectorAll('.fire-item').forEach(el=>{
    el.addEventListener('click', ()=>{
      try {
        const c = JSON.parse(el.getAttribute('data-center'));
        if (Array.isArray(c) && c.length===2) window.map.flyTo([c[1], c[0]], 9, { duration: 0.8 });
      } catch(e){}
    });
  });
}

function applyFireFilters() {
  // WFIGS perimeters
  if (_perimLayer) {
    _perimLayer.eachLayer(l => {
      const p = l.feature?.properties ?? {};
      const pct = Number(p.percentcontained ?? p.poly_PercentContained ?? p.PERCENT_CONTAINED);
      const acres = p.gisacres ?? p.poly_GISAcres ?? p.GISAcres;

      let ok = true;
      if (fireFilters.contain === "lt70"  && !(Number.isFinite(pct) && pct < 70)) ok = false;
      if (fireFilters.contain === "gte70" && !(Number.isFinite(pct) && pct >=70)) ok = false;
      const sb = sizeBucket(acres);
      if (fireFilters.size !== "all" && sb !== fireFilters.size) ok = false;

      if (ok) { l.addTo(_group); } else { _group.removeLayer(l); }
    });
  }

  // CAL FIRE
  if (_calfireLayer) {
    _calfireLayer.eachLayer(l => {
      const p = l.feature?.properties ?? {};
      const pct = Number(p.PercentContained ?? p.percentcontained ?? p.PERCENT_CONTAINED);
      const acres = p.AcresBurned ?? p.GISAcres ?? p.DailyAcres ?? p.acres;

      let ok = true;
      if (fireFilters.contain === "lt70"  && !(Number.isFinite(pct) && pct < 70)) ok = false;
      if (fireFilters.contain === "gte70" && !(Number.isFinite(pct) && pct >=70)) ok = false;
      const sb = sizeBucket(acres);
      if (fireFilters.size !== "all" && sb !== fireFilters.size) ok = false;

      if (l._icon) l._icon.style.display = (ok ? "" : "none");
      else ok ? l.addTo(_group) : _group.removeLayer(l);
    });
  }

  // FIRMS（time）
  if (_firmsLayer) {
    const now = Date.now();
    _firmsLayer.eachLayer(l => {
      const p = l.feature?.properties ?? {};
      const t = String(p.acq_time||"").padStart(4,"0");
      const iso = p.acq_date ? `${p.acq_date}T${t.slice(0,2)}:${t.slice(2,4)}:00Z` : null;
      const ms  = iso ? new Date(iso).getTime() : null;

      let ok = true;
      if (fireFilters.firmsTime !== "all" && Number.isFinite(ms)) {
        const spanH = fireFilters.firmsTime === "24h" ? 24 : 24*7;
        ok = (now - ms) <= spanH*3600*1000;
      }
      if (l._path) l._path.style.display = (ok ? "" : "none");
      else ok ? l.addTo(_group) : _group.removeLayer(l);
    });
  }

  rebuildFireList();
}

// ======================= Internal state & API ===============================
let _group = null;
let _perimLayer = null;
let _firmsLayer = null;
let _calfireLayer = null;
let _refreshTimer = null;

export async function enableFire() {
  const map = window.map;
  if (!map) throw new Error("Map not found: make sure window.map is set.");

  if (_group) { _group.addTo(map); addFireLegend(map); ensureFireSidebar(map); ensureFireSubFilters(map); rebuildFireList(); return _group; }

  // panes for z-index layering
  if (!map.getPane("perimPane")) {
    map.createPane("perimPane");   map.getPane("perimPane").style.zIndex   = 420;
    map.createPane("firmsPane");   map.getPane("firmsPane").style.zIndex   = 430;
    map.createPane("calfirePane"); map.getPane("calfirePane").style.zIndex = 440;
  }

  _group = L.layerGroup().addTo(map);

  // 1) WFIGS perimeters
  try {
    const perimGeo = await fetchJSON(buildPerimeterUrl());
    _perimLayer = L.geoJSON(perimGeo, {
      filter: validPerimeter,
      style: perimStyle,
      onEachFeature: perimPopup
    }).addTo(_group);
  } catch (e) {
    console.warn("WFIGS perimeters load failed:", e);
  }

  // 2) FIRMS hotspots
  try {
    const firmsGeo = await fetchJSON(FIRMS_URL);
    _firmsLayer = L.geoJSON(firmsGeo, {
      filter: validFirmsPoint,
      pointToLayer: firmsMarker,
      onEachFeature: firmsPopup
    }).addTo(_group);
  } catch (e) {
    console.warn("FIRMS hotspots load failed:", e);
  }

  // 3) CAL FIRE incidents
  try {
    const calGeo = await fetchJSON(CALFIRE_URL);
    _calfireLayer = L.geoJSON(calGeo, {
      pointToLayer: (feat, latlng) => calfirePoint(latlng, feat),
      style: calfireStyle,
      onEachFeature: calfireOnEach
    }).addTo(_group);
  } catch (e) {
    console.warn("CAL FIRE incidents load failed:", e);
  }

  // Legend + UI
  addFireLegend(map);
  ensureFireSidebar(map);
  ensureFireSubFilters(map);
  rebuildFireList();

  // Unified refresh each 60 min
  clearInterval(_refreshTimer);
  _refreshTimer = setInterval(async () => {
    try {
      if (_perimLayer) {
        const freshPerim = await fetchJSON(buildPerimeterUrl());
        _perimLayer.clearLayers(); _perimLayer.addData(freshPerim);
      }
      if (_firmsLayer) {
        const freshFirms = await fetchJSON(FIRMS_URL);
        _firmsLayer.clearLayers(); _firmsLayer.addData(freshFirms);
      }
      if (_calfireLayer) {
        const freshCal = await fetchJSON(CALFIRE_URL);
        _calfireLayer.clearLayers(); _calfireLayer.addData(freshCal);
      }
      applyFireFilters();
      rebuildFireList();
    } catch (e) {
      console.warn("Fire mode refresh failed:", e);
    }
  }, 60 * 60 * 1000);

  return _group;
}
window.__prog = () => {
  if (!_perimLayer) return console.warn("no perim layer");
  const l = _perimLayer.getLayers()[0];
  if (!l?.feature) return console.warn("no feature");
  console.log("[prog] run:", l.feature?.properties?.IncidentName);
  showFirmsProgressionForPerimeter(l.feature, PROG_LAST_N_DAYS);
};

export function disableFire() {
  const map = window.map;
  if (!map) return;

  if (_group) {
    try { map.removeLayer(_group); } catch(_) {}
    _group = null;
  }
  _perimLayer = null;
  _firmsLayer = null;
  _calfireLayer = null;

  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }

  removeFireLegend(map);
  if (_fireFilterCtl){ try { map.removeControl(_fireFilterCtl); } catch(_) {} _fireFilterCtl = null; }
  if (_fireListCtl)  { try { map.removeControl(_fireListCtl); } catch(_) {} _fireListCtl = null; }
}
// ===== FIRMS 近几日“蔓延感知”覆盖层（近似版） =====
function ymd(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function lastNDates(n){
  const out=[]; const today=new Date();
  for (let i=0;i<n;i++){ const d=new Date(today); d.setDate(today.getDate()-i); out.push(ymd(d)); }
  return out;
}
function haversineKm(lat1,lon1,lat2,lon2){
  const toRad = (x)=>x*Math.PI/180, R=6371;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}
async function tryFetchJSON(url){
  try{
    const r = await fetch(url, { cache:"no-store" });
    if (!r.ok) return null;
    return await r.json();
  }catch{ return null; }
}

let _firmsProgLayer = null;
let _firmsProgLegend = null;

function removeFirmsProgression(map){
  if (_firmsProgLayer){ try{ map.removeLayer(_firmsProgLayer); }catch{} _firmsProgLayer=null; }
  if (_firmsProgLegend){ try{ map.removeControl(_firmsProgLegend);}catch{} _firmsProgLegend=null; }
}

function buildProgCircle(lat, lng, color){
  const disk = L.circle([lat,lng], {
    radius: PROG_CIRCLE_RADIUS_M,
    color, weight: 1, fillColor: color, fillOpacity: 0.35,
    pane: "firmsPane"
  });
  const hit = L.circle([lat,lng], {
    radius: Math.max(PROG_CIRCLE_RADIUS_M, 600),
    color:"transparent", fillColor:"transparent", opacity:0, fillOpacity:0,
    pane:"firmsPane", interactive:true
  });
  return L.featureGroup([disk, hit]);
}

async function showFirmsProgressionForPerimeter(perimFeature, days=PROG_LAST_N_DAYS){
  const map = window.map;
  removeFirmsProgression(map);

  // 用你文件里已有的工具函数：getFeatureCenter(f)（在末尾 Utils 里）
  const [cx, cy] = getFeatureCenter(perimFeature); // [lng, lat]
  const dates = lastNDates(days);

  const layerGroups = [];
  const legendItems = [];

  for (let i=dates.length-1; i>=0; i--){
    const d = dates[i];
    const url = `public/data/firms_ca_${d}.geojson`; // 你的命名
    const gj = await tryFetchJSON(url);
    if (!gj || !gj.features) continue;

    const color = PROG_COLORS[(dates.length-1 - i) % PROG_COLORS.length];
    const g = L.layerGroup([], { pane: "firmsPane" });

    for (const f of gj.features){
      const gmr = f.geometry;
      if (!gmr || gmr.type!=="Point") continue;
      const [lng, lat] = gmr.coordinates;
      if (haversineKm(cy, cx, lat, lng) > PROG_SEARCH_RADIUS_KM) continue;
      g.addLayer(buildProgCircle(lat, lng, color));
    }
    if (g.getLayers().length){
      layerGroups.push(g);
      legendItems.push({ label: d, color });
    }
  }

  if (!layerGroups.length){
    alert("附近未找到最近几天的 FIRMS 数据。");
    return;
  }

  _firmsProgLayer = L.layerGroup(layerGroups).addTo(map);

  const Legend = L.Control.extend({
    options: { position: "bottomright" },
    onAdd: function(){
      const div = L.DomUtil.create("div", "panel legend firms-prog-legend");
      div.innerHTML = `
        <div class="panel-title">FIRMS Progression (Approximately)</div>
        <div class="list">
          ${legendItems.map(it=>`
            <div class="legend-row">
              <span class="swatch" style="background:${it.color}"></span>
              <span>${it.label}</span>
            </div>`).join("")}
          <div style="margin-top:6px">
            <button class="btn" id="btn-hide-prog">Hidden Spread</button>
          </div>
        </div>`;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      setTimeout(()=>{
        div.querySelector("#btn-hide-prog")?.addEventListener("click", ()=> removeFirmsProgression(window.map));
      },0);
      return div;
    }
  });
  _firmsProgLegend = new Legend().addTo(map);
}

// ======================= Utils =============================================
function getFeatureCenter(f) {
  const g = f.geometry;
  if (!g) return [ -120, 37 ];
  if (g.type === "Point") return g.coordinates;
  const polys = g.type === "Polygon" ? [g.coordinates] : (g.type==="MultiPolygon" ? g.coordinates : []);
  let sx=0, sy=0, n=0;
  polys.forEach(rings => {
    if (!Array.isArray(rings) || rings.length===0) return;
    const ring = rings[0];
    ring.forEach(([x,y])=>{ if (isNum(x)&&isNum(y)) { sx+=x; sy+=y; n++; }});
  });
  return n>0 ? [sx/n, sy/n] : [-120,37];
}
// ================================== END =====================================
