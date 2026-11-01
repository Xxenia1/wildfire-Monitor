// fetch firms VIIRS data as csv and convert it to geojson
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import Papa from "papaparse";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== CONFIG =====
const FIRMS_KEY = process.env.FIRMS_KEY; // 从环境变量注入（Actions Secrets）
if (!FIRMS_KEY) {
  console.error("Missing FIRMS_KEY env var.");
  process.exit(1);
}
const CA_BBOX = [-125, 32, -113, 43.5].join(",");
const SOURCE  = process.env.FIRMS_SOURCE || "VIIRS_SNPP_NRT";
const DAY     = process.env.FIRMS_DAY || "1";
const CSV_URL = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY}/${SOURCE}/${CA_BBOX}/${DAY}`;
const RECENT_URL = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY}/${SOURCE}/${CA_BBOX}/5`;

const OUT_DIR    = path.resolve(__dirname, "..", "public", "data");
const OUT_LATEST = path.join(OUT_DIR, "firms_ca_latest.geojson");
const OUT_RECENT = path.join(OUT_DIR, "firms_ca_recent.geojson");

function toGeoJSON(csvText, dayRange) {
  const parsed = Papa.parse(csvText.trim(), { header: true, dynamicTyping: true });
  if (parsed.errors.length || !parsed.meta.fields?.includes("latitude") || !parsed.meta.fields?.includes("longitude")) {
    throw new Error("Invalid FIRMS CSV; existing snapshot was preserved");
  }
  const rows = parsed.data.filter(r => r && r.latitude && r.longitude);
  const features = rows.map(r => ({
    type: "Feature",
    properties: {
      acq_date: r.acq_date, acq_time: r.acq_time, confidence: r.confidence,
      satellite: r.satellite, instrument: r.instrument, version: r.version,
      bright_ti4: r.bright_ti4, frp: r.frp, daynight: r.daynight
    },
    geometry: { type: "Point", coordinates: [Number(r.longitude), Number(r.latitude)] }
  }));
  return {
    type: "FeatureCollection",
    name: `FIRMS VIIRS CA (last ${dayRange} days)`,
    crs: { type: "name", properties: { name: "EPSG:4326" } },
    fetched_at_utc: new Date().toISOString(),
    // Never include the request URL: it contains the FIRMS API key.
    source: { provider: "NASA FIRMS", dataset: SOURCE, bbox: CA_BBOX, day_range: dayRange },
    features
  };
}
const hash = s => crypto.createHash("sha256").update(s).digest("hex");

async function withRetry(fn, times=3, delay=1500) {
  let err;
  for (let i=0;i<times;i++){ try { return await fn(); } catch(e){ err=e; if(i<times-1) await new Promise(r=>setTimeout(r,delay)); } }
  throw err;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  async function fetchCSV(url) { return withRetry(async () => {
    let r;
    try {
      r = await fetch(url, { timeout: 30000 });
    } catch (e) {
      // Fetch errors can include the request URL, including its API key.
      throw new Error(`FIRMS request failed: ${e.code || e.name || "network error"}`);
    }
    if (!r.ok) throw new Error(`FIRMS HTTP ${r.status}`);
    return await r.text();
  }); }

  const latest = toGeoJSON(await fetchCSV(CSV_URL), DAY);
  const recent = toGeoJSON(await fetchCSV(RECENT_URL), "5");
  const content = JSON.stringify(latest);
  const recentContent = JSON.stringify(recent);
  if (content.includes(FIRMS_KEY) || recentContent.includes(FIRMS_KEY)) {
    throw new Error("Refusing to write FIRMS API key to public data");
  }

  for (const [output, next] of [[OUT_LATEST, content], [OUT_RECENT, recentContent]]) {
    const old = fs.existsSync(output) ? fs.readFileSync(output, "utf-8") : "";
    if (hash(old) === hash(next)) continue;
    const temp = `${output}.tmp`;
    fs.writeFileSync(temp, next);
    fs.renameSync(temp, output);
  }
  console.log(`Updated FIRMS snapshots: latest=${latest.features.length}, recent=${recent.features.length}`);
})();
