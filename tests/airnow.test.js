import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildAirNowUrl, normalizeAirNow } from "../scripts/airnow_snapshot.js";

test("AirNow request uses one California hourly bbox and a bounded time window", () => {
  const url = buildAirNowUrl("test-key", new Date("2026-11-02T00:40:00Z"));
  assert.equal(url.searchParams.get("startDate"), "2026-11-01T20");
  assert.equal(url.searchParams.get("endDate"), "2026-11-01T23");
  assert.equal(url.searchParams.get("BBOX"), "-125,32,-113,43.5");
  assert.equal(url.searchParams.get("API_KEY"), "test-key");
});

test("AirNow site data keeps the newest PM2.5 AQI and excludes invalid records", () => {
  const records = [
    { AQSID: "060450006", Parameter: "PM2.5", Latitude: 37, Longitude: -120, AQI: 60, UTC: "2026-11-01T20:00", RawConcentration: 16 },
    { AQSID: "060450006", Parameter: "PM25", Latitude: 37, Longitude: -120, AQI: 80, UTC: "2026-11-01T21:00", RawConcentration: 24 },
    { AQSID: "060450007", Parameter: "OZONE", Latitude: 37, Longitude: -119, AQI: 25, UTC: "2026-11-01T21:00" },
    { AQSID: "060450008", Parameter: "PM2.5", Latitude: 48, Longitude: -120, AQI: 50, UTC: "2026-11-01T21:00" },
    { AQSID: "410330036", Parameter: "PM2.5", Latitude: 42, Longitude: -123, AQI: 50, UTC: "2026-11-01T21:00" },
  ];
  const snapshot = normalizeAirNow(records, new Date("2026-11-01T22:00:00Z"));
  assert.equal(snapshot.features.length, 1);
  assert.equal(snapshot.features[0].properties.aqi, 80);
  assert.equal(snapshot.features[0].properties.pm2_5, 24);
  assert.equal(snapshot.source_updated_at_utc, "2026-11-01T21:00:00.000Z");
  assert.equal(snapshot.preliminary, true);
});

test("AirNow fetch writes a key-free snapshot and keeps it after an API failure", async () => {
  const originalDirectory = process.cwd();
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.AIRNOW_API_KEY;
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wf-airnow-test-"));
  try {
    process.chdir(temporaryDirectory);
    process.env.AIRNOW_API_KEY = "test-secret";
    const observed = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    globalThis.fetch = async url => {
      assert.equal(url.searchParams.get("API_KEY"), "test-secret");
      return new Response(JSON.stringify([{
        AQSID: "060450006", SiteName: "Monitor A", Parameter: "PM2.5", Latitude: 37,
        Longitude: -120, AQI: 85, UTC: observed, RawConcentration: 25,
      }]), { status: 200 });
    };
    const script = pathToFileURL(path.join(originalDirectory, "scripts/fetch_airnow.js")).href;
    await import(`${script}?success`);
    const output = path.join(temporaryDirectory, "public/data/smoke_ca_latest.geojson");
    const saved = fs.readFileSync(output, "utf8");
    assert.equal(JSON.parse(saved).features[0].properties.aqi, 85);
    assert.ok(!saved.includes("test-secret"));

    globalThis.fetch = async () => new Response("limited", { status: 429 });
    await assert.rejects(import(`${script}?failure`), /AirNow HTTP 429/);
    assert.equal(fs.readFileSync(output, "utf8"), saved);
  } finally {
    process.chdir(originalDirectory);
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.AIRNOW_API_KEY;
    else process.env.AIRNOW_API_KEY = originalKey;
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
