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

const OUT_DIR    = path.resolve(__dirname, "..", "public", "data");
const OUT_LATEST = path.join(OUT_DIR, "firms_ca_latest.geojson");
const OUT_DATED  = path.join(OUT_DIR, `firms_ca_${new Date().toISOString().slice(0,10)}.geojson`);

function toGeoJSON(csvText) {
  const parsed = Papa.parse(csvText.trim(), { header: true, dynamicTyping: true });
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
    name: "FIRMS VIIRS CA (last 1 day)",
    crs: { type: "name", properties: { name: "EPSG:4326" } },
    fetched_at_utc: new Date().toISOString(),
    source: { url: CSV_URL, dataset: SOURCE, bbox: CA_BBOX, day_range: DAY },
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
  const csvText = await withRetry(async () => {
    const r = await fetch(CSV_URL, { timeout: 30000 });
    if (!r.ok) throw new Error(`FIRMS HTTP ${r.status}`);
    return await r.text();
  });

  const gj = toGeoJSON(csvText);
  const content = JSON.stringify(gj);

  const existed = fs.existsSync(OUT_LATEST);
  const old = existed ? fs.readFileSync(OUT_LATEST, "utf-8") : "";
  if (existed && hash(old) === hash(content)) {
    console.log("No changes in FIRMS data. Skipping update.");
    process.exit(0);
  }

  fs.writeFileSync(OUT_LATEST, content);
  fs.writeFileSync(OUT_DATED,  content);
  console.log(`Wrote ${OUT_LATEST} & ${OUT_DATED}, features=${gj.features.length}`);
})();
