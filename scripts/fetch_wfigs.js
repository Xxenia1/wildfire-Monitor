// Cache current California fire perimeters for all visitors.
import fs from "node:fs";
import path from "node:path";

const url = new URL("https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query");
for (const [key, value] of Object.entries({
  f: "geojson", where: "1=1", outFields: "*", outSR: "4326",
  geometry: "-125,32,-113,43.5", geometryType: "esriGeometryEnvelope",
  inSR: "4326", spatialRel: "esriSpatialRelIntersects",
})) url.searchParams.set(key, value);

let response;
try {
  response = await fetch(url, { signal: AbortSignal.timeout(30000) });
} catch (error) {
  throw new Error(`WFIGS request failed: ${error.name}`);
}
if (!response.ok) throw new Error(`WFIGS HTTP ${response.status}; existing snapshot was preserved`);
const payload = await response.json();
if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
  throw new Error("Invalid WFIGS GeoJSON; existing snapshot was preserved");
}
const snapshot = { ...payload, fetched_at_utc: new Date().toISOString() };
const output = path.resolve("public/data/wfigs_perimeters_latest.geojson");
fs.mkdirSync(path.dirname(output), { recursive: true });
const temp = `${output}.tmp`;
fs.writeFileSync(temp, JSON.stringify(snapshot));
fs.renameSync(temp, output);
console.log(`Wrote ${output}, perimeters=${payload.features.length}`);
