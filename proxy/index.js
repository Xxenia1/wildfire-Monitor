import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8787;
const PURPLEAIR_API_KEY = process.env.PURPLEAIR_API_KEY;

if (!PURPLEAIR_API_KEY) {
  console.error("ERROR: Missing PURPLEAIR_API_KEY in .env");
  process.exit(1);
}

// ---- CORS ----
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
  })
);
app.use(morgan("dev"));

// ---- cache ----
const cache = new Map();
const PA_BASE = "https://api.purpleair.com/v1";

function makeCacheKey(path, query) {
  const sorted = [...new URLSearchParams(query).entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `${path}?${new URLSearchParams(sorted).toString()}`;
}
function getCached(path, query, ttlSec) {
  const key = makeCacheKey(path, query);
  const hit = cache.get(key);
  if (!hit) return null;
  const age = (Date.now() - hit.ts) / 1000;
  if (age > ttlSec) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}
function setCached(path, query, data) {
  const key = makeCacheKey(path, query);
  cache.set(key, { ts: Date.now(), data });
}

// ---- helpers ----
function inBbox(rec, bbox) {
  const [w, s, e, n] = bbox.map(Number);
  const lat = rec.latitude ?? rec.sensor?.latitude;
  const lon = rec.longitude ?? rec.sensor?.longitude;
  return Number.isFinite(lat) && Number.isFinite(lon) && lon >= w && lon <= e && lat >= s && lat <= n;
}

// Normalize PurpleAir columnar response to array of objects
function normalizeRecords(json) {
  const fields = Array.isArray(json?.fields) ? json.fields : null;
  const rows = Array.isArray(json?.data) ? json.data : [];
  if (fields && rows.length && Array.isArray(rows[0])) {
    return rows.map(row => {
      const obj = {};
      fields.forEach((name, i) => { obj[name] = row[i]; });
      return obj;
    });
  }
  return rows; // already objects
}

function recordToFeature(rec) {
  const lat = rec.latitude ?? rec.sensor?.latitude;
  const lon = rec.longitude ?? rec.sensor?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: {
      id: rec.sensor_index ?? rec.id ?? rec.sensor?.id ?? undefined,
      name: rec.name ?? rec.sensor?.name ?? null,
      // NOTE: PurpleAir uses "pm2.5_atm" (with a dot)
      pm2_5: rec["pm2.5_atm"] ?? rec.pm2_5_atm ?? rec.pm2_5 ?? null,
      humidity: rec.humidity ?? null,
      temperature: rec.temperature ?? null,
      pressure: rec.pressure ?? null,
      last_seen: rec.last_seen ?? null,
      raw: rec
    }
  };
}

// ---- routes ----
app.get("/api/sensors", async (req, res) => {
  try {
    const { bbox, cache_ttl = "30", fields, ...rest } = req.query;
    const ttl = Math.max(0, parseInt(cache_ttl, 10) || 30);

    const cached = ttl > 0 ? getCached(req.path, req.query, ttl) : null;
    if (cached) return res.json(cached);

    const DEFAULT_FIELDS = "latitude,longitude,pm2.5_atm,name,last_seen,humidity,temperature,pressure";
    const url = new URL(`${PA_BASE}/sensors`);
    url.searchParams.set("fields", fields || DEFAULT_FIELDS);

    // passthrough other params (location_type, n, max_age, types, etc.)
    for (const [k, v] of Object.entries(rest)) {
      if (Array.isArray(v)) v.forEach(val => url.searchParams.append(k, val));
      else url.searchParams.set(k, v);
    }

    const upstream = await fetch(url.toString(), {
      headers: { "X-API-Key": PURPLEAIR_API_KEY },
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: "PurpleAir error", detail: text });
    }
    const json = await upstream.json();

    // --- FIX: normalize first ---
    const rows = normalizeRecords(json);

    let final;
    if (bbox) {
      const parts = bbox.split(",").map(Number);
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        const filtered = rows.filter(r => inBbox(r, parts));
        final = { ...json, data: filtered, count: filtered.length };
      } else {
        final = { ...json, data: rows };
      }
    } else {
      final = { ...json, data: rows };
    }

    if (ttl > 0) setCached(req.path, req.query, final);
    res.json(final);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Proxy error", detail: String(e) });
  }
});

app.get("/api/sensors/geojson", async (req, res) => {
  try {
    const self = new URL(`${req.protocol}://${req.get("host")}/api/sensors`);
    for (const [k, v] of Object.entries(req.query)) {
      if (Array.isArray(v)) v.forEach(val => self.searchParams.append(k, val));
      else self.searchParams.set(k, v);
    }
    const resp = await fetch(self.toString());
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: "Upstream /api/sensors error", detail: text });
    }
    const raw = await resp.json();

    // --- FIX: normalize here too ---
    const list = normalizeRecords(raw);

    const features = [];
    for (const rec of list) {
      const f = recordToFeature(rec);
      if (f) features.push(f);
    }

    res.json({ type: "FeatureCollection", features });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Proxy error", detail: String(e) });
  }
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`PurpleAir proxy running on http://localhost:${PORT}`);
});
