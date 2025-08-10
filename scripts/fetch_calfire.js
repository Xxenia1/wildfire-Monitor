// scripts/fetch_calfire.js
// 目标：拉取 CAL FIRE incidents，只保留“近24小时（加州时区）”的数据
// 优先 GeoJSON；失败退回 JSON 再转；都失败用 ArcGIS 备胎。
// 额外：保存原始响应到 public/data/debug 方便排查。

import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const OUT_DIR   = "public/data";
const OUT_FILE  = path.join(OUT_DIR, "calfire_incidents_latest.geojson");
const DBG_DIR   = path.join(OUT_DIR, "debug");
const DBG_GEO   = path.join(DBG_DIR, "calfire_raw_geojson.json");
const DBG_LIST  = path.join(DBG_DIR, "calfire_raw_list.json");

const BASE = "https://incidents.fire.ca.gov/umbraco/api/IncidentApi";
// 不再带 year 参数（不少时候它会反而限制结果）
const URL_GEO  = `${BASE}/GeoJsonList?inactive=true`;
const URL_LIST = `${BASE}/List?inactive=true`;

const FALLBACK_ARCGIS =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson";

// ========== 时区与时间窗口 ==========
function nowPT() {
  // 取当前 UTC 时间，再转到 PT 不是必要的；我们用 Intl 来做日期字符串比较即可
  return new Date();
}
function toPTDate(d) {
  // 返回 PT 下的 yyyy-MM-dd HH:mm 字符串（用于日志）
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(d);
}
function withinLastHoursPT(dateStr, hours = 24) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  // 将“现在”和“目标时间”都转换为 PT 的纪元毫秒再比较
  const now = new Date();
  const nowPTms = now.getTime() - (now.getTimezoneOffset() * 60000); // 这只是近似；我们用时差窗口足够宽容
  const tgtPTms = d.getTime() - (d.getTimezoneOffset() * 60000);
  const diff = nowPTms - tgtPTms;
  return diff >= 0 && diff <= hours * 3600 * 1000;
}

// ========== I/O 工具 ==========
async function fetchJSON(url) {
  const r = await fetch(url, { headers: { "Accept": "application/json" }});
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
async function saveJSON(p, obj) { ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(obj)); }

// ========== 过滤：只保留“近24小时（PT）” ==========
function filterGeoJSON_last24h(gj) {
  const candFields = [
    "StartDate", "CreateDate", "StartDateTime", "CreatedDate",
    "CreateOn", "ModifiedOnDate", "ModifiedDate", "Updated", "UpdateDate"
  ];
  const feats = (gj?.features || []).filter(f => {
    const p = f?.properties || {};
    // 只要任意一个日期字段在近24小时就保留
    return candFields.some(k => withinLastHoursPT(p[k], 24));
  });
  return { type: "FeatureCollection", features: feats };
}

function listJSON_to_last24h_GeoJSON(list) {
  const candFields = [
    "StartDate", "CreateDate", "StartDateTime", "CreatedDate",
    "CreateOn", "ModifiedOnDate", "ModifiedDate", "Updated", "UpdateDate"
  ];
  const feats = (list || [])
    .filter(x => candFields.some(k => withinLastHoursPT(x?.[k], 24)))
    .filter(x => Number.isFinite(Number(x?.Longitude)) && Number.isFinite(Number(x?.Latitude)))
    .map(x => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [Number(x.Longitude), Number(x.Latitude)] },
      properties: { ...x }
    }));
  return { type: "FeatureCollection", features: feats };
}

// ========== 主流程 ==========
async function main() {
  console.log("⏱ 现在(PT)：", toPTDate(nowPT()));

  // 1) 直接 GeoJSON -> 调试保存 -> 过滤近24h
  try {
    const rawGeo = await fetchJSON(URL_GEO);
    await saveJSON(DBG_GEO, rawGeo);
    console.log("✅ GeoJsonList 返回 features:", rawGeo?.features?.length ?? 0);

    const only24 = filterGeoJSON_last24h(rawGeo);
    console.log("✅ GeoJsonList 过滤后(近24h) features:", only24.features.length);

    await saveJSON(OUT_FILE, only24);
    console.log(`✅ wrote ${OUT_FILE}`);
    return;
  } catch (e) {
    console.warn("GeoJsonList failed:", e.message);
  }

  // 2) List(JSON) -> 调试保存 -> 转 GeoJSON -> 过滤近24h
  try {
    const rawList = await fetchJSON(URL_LIST);
    await saveJSON(DBG_LIST, rawList);
    console.log("✅ List 返回条数:", Array.isArray(rawList) ? rawList.length : 0);

    const only24 = listJSON_to_last24h_GeoJSON(rawList);
    console.log("✅ List 转换后(近24h) features:", only24.features.length);

    await saveJSON(OUT_FILE, only24);
    console.log(`✅ wrote ${OUT_FILE}`);
    return;
  } catch (e) {
    console.warn("List JSON failed:", e.message);
  }

  // 3) 兜底：ArcGIS（不做24h过滤，只是保证有数据）
  try {
    const gj = await fetchJSON(FALLBACK_ARCGIS);
    console.log("⚠️ 使用 ArcGIS 备胎,features:", gj?.features?.length ?? 0);
    await saveJSON(OUT_FILE, gj);
  } catch (e) {
    console.error("ArcGIS fallback failed:", e.message);
    process.exit(1);
  }
}

main();

