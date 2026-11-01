import fs from "node:fs";
import path from "node:path";
import { buildAirNowUrl, normalizeAirNow } from "./airnow_snapshot.js";

const key = process.env.AIRNOW_API_KEY?.trim();
if (!key) throw new Error("Missing AIRNOW_API_KEY secret");

// Never log the URL or the upstream response body: the URL contains the key.
const url = buildAirNowUrl(key);
let response;
try {
  response = await fetch(url, { signal: AbortSignal.timeout(30000) });
} catch (error) {
  throw new Error(`AirNow request failed: ${error.name}`);
}
if (!response.ok) throw new Error(`AirNow HTTP ${response.status}; existing snapshot was preserved`);

let rows;
try { rows = await response.json(); }
catch { throw new Error("AirNow returned invalid JSON; existing snapshot was preserved"); }
const snapshot = normalizeAirNow(rows);
const observationAgeMs = Date.now() - Date.parse(snapshot.source_updated_at_utc);
if (!Number.isFinite(observationAgeMs) || observationAgeMs < -60 * 60 * 1000 || observationAgeMs > 6 * 60 * 60 * 1000) {
  throw new Error("AirNow observations are outside the current six-hour window; existing snapshot was preserved");
}
const content = JSON.stringify(snapshot);
if (content.includes(key)) throw new Error("Refusing to save an AirNow response containing the API key");

const output = path.resolve("public/data/smoke_ca_latest.geojson");
fs.mkdirSync(path.dirname(output), { recursive: true });
const temporary = `${output}.tmp`;
fs.writeFileSync(temporary, content);
fs.renameSync(temporary, output);
console.log(`Updated AirNow smoke snapshot: sites=${snapshot.features.length}, observation=${snapshot.source_updated_at_utc}`);
