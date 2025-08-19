// js/smoke_mode.js
// 1) 改成你的 Vercel 项目域名
const PROXY_BASE = "https://purpleair-proxy.vercel.app";

// 2) 加州范围
const CA_BBOX = [-125, 32, -113, 43.5]; // [W,S,E,N]

// ======== AQI 计算（EPA 24h PM2.5） ========
function pm25ToAQI(pm) {
  const bp = [
    { cLo: 0.0,   cHi: 12.0,  iLo: 0,   iHi: 50  },
    { cLo: 12.1,  cHi: 35.4,  iLo: 51,  iHi: 100 },
    { cLo: 35.5,  cHi: 55.4,  iLo: 101, iHi: 150 },
    { cLo: 55.5,  cHi: 150.4, iLo: 151, iHi: 200 },
    { cLo: 150.5, cHi: 250.4, iLo: 201, iHi: 300 },
    { cLo: 250.5, cHi: 350.4, iLo: 301, iHi: 400 },
    { cLo: 350.5, cHi: 500.4, iLo: 401, iHi: 500 },
  ];
  const x = Math.max(0, Math.min(pm ?? 0, 500.4));
  const seg = bp.find(s => x >= s.cLo && x <= s.cHi) || bp[bp.length - 1];
  const aqi = ((seg.iHi - seg.iLo) / (seg.cHi - seg.cLo)) * (x - seg.cLo) + seg.iLo;
  return Math.round(aqi);
}

function getAqiColor(aqi) {
  if (aqi <= 50)  return "#00e400";
  if (aqi <= 100) return "#ffff00";
  if (aqi <= 150) return "#ff7e00";
  if (aqi <= 200) return "#ff0000";
  if (aqi <= 300) return "#8f3f97";
  return "#7e0023";
}

// ======== URL 拼接 ========
function buildSensorsGeoJSONUrl({
  bbox = CA_BBOX.join(","),   // 只拉加州，省积分
  n = 500,                    // 返回最多 500 个点
  maxAgeMin = 60,             // 过去 60 min 内更新的点
  locationType = 0,           // 户外
  cacheTtl = 600,             // 代理缓存 10 分钟（强烈建议）
  fields = "latitude,longitude,pm2.5_atm,name,last_seen,humidity,temperature,pressure",
} = {}) {
  const url = new URL(`${PROXY_BASE}/api/sensors-geojson`);
  url.searchParams.set("bbox", bbox);
  url.searchParams.set("n", String(n));
  url.searchParams.set("max_age", String(maxAgeMin));
  url.searchParams.set("location_type", String(locationType));
  url.searchParams.set("cache_ttl", String(cacheTtl));
  url.searchParams.set("fields", fields);
  return url.toString();
}

// ======== 内部状态 ========
let smokeLayerGroup = null;
let infoControl = null;
let legendControl = null;
let refreshTimer = null;

// ======== 渲染 ========
function makeMarker(feature, latlng) {
  const pm = feature?.properties?.pm2_5 ?? null;
  const aqi = pm != null ? pm25ToAQI(pm) : null;
  const color = aqi != null ? getAqiColor(aqi) : "#999";
  return L.circleMarker(latlng, {
    radius: 5,
    color,
    fillColor: color,
    fillOpacity: 0.8,
    weight: 1,
  });
}

function bindPopup(feature, layer) {
  const p = feature.properties || {};
  const aqi = p.pm2_5 != null ? pm25ToAQI(p.pm2_5) : null;
  const last = p.last_seen ? new Date(p.last_seen * 1000).toLocaleString() : "n/a";
  const html = `
    <div style="min-width:220px">
      <div><b>${p.name || "Unknown"}</b></div>
      <div>PM2.5: <b>${p.pm2_5 ?? "n/a"}</b> μg/m³</div>
      <div>AQI: <b>${aqi ?? "n/a"}</b></div>
      <div>Temp: ${p.temperature ?? "n/a"} °F</div>
      <div>RH: ${p.humidity ?? "n/a"} %</div>
      <div>Pressure: ${p.pressure ?? "n/a"} mb</div>
      <div>Last seen: ${last}</div>
    </div>`;
  layer.bindPopup(html);
}

function drawSmokeLayer(map, features) {
  // 清理旧图层
  if (smokeLayerGroup) {
    map.removeLayer(smokeLayerGroup);
    smokeLayerGroup = null;
  }

  smokeLayerGroup = L.geoJSON(
    { type: "FeatureCollection", features: features || [] },
    {
      pointToLayer: makeMarker,
      onEachFeature: bindPopup,
    }
  ).addTo(map);
}

// ======== 控件（可选） ========
function addLegend(map) {
  if (legendControl) map.removeControl(legendControl);
  legendControl = L.control({ position: "bottomright" });
  legendControl.onAdd = function () {
    const div = L.DomUtil.create("div", "info legend");
    const stops = [
      [0, 50, "#00e400", "0–50"],
      [51, 100, "#ffff00", "51–100"],
      [101, 150, "#ff7e00", "101–150"],
      [151, 200, "#ff0000", "151–200"],
      [201, 300, "#8f3f97", "201–300"],
      [301, 500, "#7e0023", "301–500"],
    ];
    div.innerHTML = `<b>AQI (PM2.5)</b><br>` + stops.map(s =>
      `<i style="background:${s[2]};width:12px;height:12px;display:inline-block;margin-right:6px;"></i>${s[3]}`
    ).join("<br>");
    return div;
  };
  legendControl.addTo(map);
}

function addInfo(map) {
  if (infoControl) map.removeControl(infoControl);
  infoControl = L.control({ position: "topright" });
  infoControl.onAdd = function () {
    const div = L.DomUtil.create("div", "info");
    div.style.padding = "6px 8px";
    div.style.background = "white";
    div.style.borderRadius = "6px";
    div.style.boxShadow = "0 1px 4px rgba(0,0,0,0.2)";
    div.innerHTML = `<b>Smoke (PurpleAir)</b><div id="smoke-meta" style="font-size:12px;color:#666">Loading…</div>`;
    return div;
  };
  infoControl.addTo(map);
}

function updateInfo(meta) {
  const el = document.getElementById("smoke-meta");
  if (!el) return;
  const ts = meta?.latest ?? null;
  el.textContent = ts ? `Latest: ${new Date(ts * 1000).toLocaleString()}` : "Latest: n/a";
}

// ======== 对外 API ========

/**
 * 初始化：加控件 + 首次取数 +（可选）定时刷新
 */
export async function initSmokeMode(map, {
  bbox = CA_BBOX,      // [W,S,E,N]
  n = 500,
  maxAgeMin = 60,
  cacheTtl = 600,
  locationType = 0,
  refreshSec = 0,      // >0 才会自动刷新
} = {}) {
  addInfo(map);
  addLegend(map);

  await refreshSmokeMode(map, { bbox: bbox.join(","), n, maxAgeMin, cacheTtl, locationType });

  if (refreshTimer) clearInterval(refreshTimer);
  if (refreshSec > 0) {
    refreshTimer = setInterval(() => {
      refreshSmokeMode(map, { bbox: bbox.join(","), n, maxAgeMin, cacheTtl, locationType })
        .catch(err => console.error("smoke refresh error:", err));
    }, refreshSec * 1000);
  }

  return smokeLayerGroup;
}

/**
 * 手动刷新（被 init 或按钮调用）
 */
export async function refreshSmokeMode(map, opts = {}) {
  const url = buildSensorsGeoJSONUrl(opts);
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) {
    const text = await resp.text();
    console.error("smoke proxy error:", resp.status, text);
    throw new Error(`Smoke fetch failed: ${resp.status}`);
  }
  const fc = await resp.json(); // { type:"FeatureCollection", features: [...] }
  drawSmokeLayer(map, fc.features || []);

  // 尝试读后端加的 stale/时间信息（没有也不报错）
  // 你的 /api/sensors-geojson 现在返回的是纯 GeoJSON，没有 meta；留个口子兼容
  updateInfo({ latest: null });
}

/**
 * 关闭：移除图层与控件、清掉定时器
 */
export function removeSmokeMode(map) {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  if (smokeLayerGroup) { map.removeLayer(smokeLayerGroup); smokeLayerGroup = null; }
  if (infoControl) { map.removeControl(infoControl); infoControl = null; }
  if (legendControl) { map.removeControl(legendControl); legendControl = null; }
}
