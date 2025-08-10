// scripts/fetch_calfire.js
// Goal：Pull CAL FIRE incidents, retaining only data from the last 24 hours (California time zone)
// Prioritize GeoJSON; if it fails, fall back to JSON and then convert it; if all else fails, use ArcGIS as a fallback.

import fs from "fs";
import path from "path";
import fetch from "node-fetch";

// define switches
const SAVE_DEBUG = false; // Change to 'true' when debugging is needed

const OUT_DIR   = "public/data";
const OUT_FILE  = path.join(OUT_DIR, "calfire_incidents_latest.geojson");
const DBG_DIR   = path.join(OUT_DIR, "debug");
const DBG_GEO   = path.join(DBG_DIR, "calfire_raw_geojson.json");
const DBG_LIST  = path.join(DBG_DIR, "calfire_raw_list.json");

const BASE = "https://incidents.fire.ca.gov/umbraco/api/IncidentApi";
// No longer takes a year parameter
const URL_GEO  = `${BASE}/GeoJsonList?inactive=true`;
const URL_LIST = `${BASE}/List?inactive=true`;

const FALLBACK_ARCGIS =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson";

// ========== Time zones and time windows ==========
function nowPT() {
  return new Date();
}
function toPTDate(d) {
  // Returns a yyyy-MM-dd HH:mm string in PT (for logging)
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
  //Convert both "now" and "target time" to PT epoch milliseconds and compare them
  const now = new Date();
  const nowPTms = now.getTime() - (now.getTimezoneOffset() * 60000); // 这只是近似；我们用时差窗口足够宽容
  const tgtPTms = d.getTime() - (d.getTimezoneOffset() * 60000);
  const diff = nowPTms - tgtPTms;
  return diff >= 0 && diff <= hours * 3600 * 1000;
}

// ========== I/O Tool ==========
async function fetchJSON(url) {
  const r = await fetch(url, { headers: { "Accept": "application/json" }});
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
async function saveJSON(p, obj) { ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(obj)); }

// ========== Filter：Only Keep“24h（PT）” ==========
function filterGeoJSON_last24h(gj) {
  const candFields = [
    "StartDate", "CreateDate", "StartDateTime", "CreatedDate",
    "CreateOn", "ModifiedOnDate", "ModifiedDate", "Updated", "UpdateDate"
  ];
  const feats = (gj?.features || []).filter(f => {
    const p = f?.properties || {};
    // As long as any date field is within the last 24 hours, it will be retained
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

// ========== Main process ==========
async function main() {
  console.log("Now (PT):", toPTDate(nowPT()));

  // 1)  GeoJSON -> save -> filter the recent 24h
  try {
    const rawGeo = await fetchJSON(URL_GEO);
    if (SAVE_DEBUG) await saveJSON(DBG_GEO, rawGeo);
    console.log("GeoJsonList features:", rawGeo?.features?.length ?? 0);

    const only24 = filterGeoJSON_last24h(rawGeo);
    console.log("GeoJsonList (last 24h) features:", only24.features.length);

    await saveJSON(OUT_FILE, only24);
    console.log(`wrote ${OUT_FILE}`);
    return;
  } catch (e) {
    console.warn("GeoJsonList failed:", e.message);
  }

  // 2) List(JSON) -> save -> convert to GeoJSON -> filter near 24h
  try {
    const rawList = await fetchJSON(URL_LIST);
    if (SAVE_DEBUG) await saveJSON(DBG_LIST, rawList);
    console.log(" List return number:", Array.isArray(rawList) ? rawList.length : 0);

    const only24 = listJSON_to_last24h_GeoJSON(rawList);
    console.log(" List after conversion (nearly 24h) features:", only24.features.length);

    await saveJSON(OUT_FILE, only24);
    console.log(` wrote ${OUT_FILE}`);
    return;
  } catch (e) {
    console.warn("List JSON failed:", e.message);
  }

  // 3)Backup: ArcGIS (no 24-hour filtering, just ensuring data availability)
  try {
    const gj = await fetchJSON(FALLBACK_ARCGIS);
    console.log("⚠️ Using ArcGIS spare tires, features:", gj?.features?.length ?? 0);
    await saveJSON(OUT_FILE, gj);
  } catch (e) {
    console.error("ArcGIS fallback failed:", e.message);
    process.exit(1);
  }
}

main();
