// proxy/index.js (ESM)

import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8787;
const PURPLEAIR_API_KEY = process.env.PURPLEAIR_API_KEY;
const DEFAULT_CACHE_TTL =
  parseInt(process.env.DEFAULT_CACHE_TTL || "600", 10) || 600; // 10 min default

if (!PURPLEAIR_API_KEY) {
  console.error("ERROR: Missing PURPLEAIR_API_KEY in .env");
  process.exit(1);
}

// ------- CORS Whitelist -------
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // No Origin (curl, local script) or whitelist is empty → Allow (development-friendly)
      if (!origin || allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
  })
);

app.use(morgan("dev"));

const PA_BASE = "https://api.purpleair.com/v1";
const cache = new Map(); 

// ------- Caching tools -------
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
function getStale(path, query) {
  const key = makeCacheKey(path, query);
  const hit = cache.get(key);
  return hit?.data || null;
}
function setCached(path, query, data) {
  const key = makeCacheKey(path, query);
  cache.set(key, { ts: Date.now(), data });
}

// ------- tools -------
function inBbox(rec, bbox) {
  const [w, s, e, n] = bbox.map(Number);
  const lat = rec.latitude ?? rec.sensor?.latitude;
  const lon = rec.longitude ?? rec.sensor?.longitude;
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lon >= w &&
    lon <= e &&
    lat >= s &&
    lat <= n
  );
}

// {fields:[], data:[[]]} → [{...}] ；Otherwise return as is data
function normalizeRecords(json) {
  const fields = Array.isArray(json?.fields) ? json.fields : null;
  const rows = Array.isArray(json?.data) ? json.data : [];
  if (fields && rows.length && Array.isArray(rows[0])) {
    return rows.map(row => {
      const obj = {};
      fields.forEach((name, i) => {
        obj[name] = row[i];
      });
      return obj;
    });
  }
  return rows;
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
      pm2_5: rec["pm2.5_atm"] ?? rec.pm2_5_atm ?? rec.pm2_5 ?? null,
      humidity: rec.humidity ?? null,
      temperature: rec.temperature ?? null,
      pressure: rec.pressure ?? null,
      last_seen: rec.last_seen ?? null,
      raw: rec,
    },
  };
}

// ================== routing: /api/sensors ==================
app.get("/api/sensors", async (req, res) => {
  try {
    const {
      bbox,
      cache_ttl = String(DEFAULT_CACHE_TTL),
      fields,
      location_type,
      n,
      max_age,
      types,
      ...rest
    } = req.query;

    const ttl = Math.max(0, parseInt(cache_ttl, 10) || DEFAULT_CACHE_TTL);

    // check cache first
    const hit = ttl > 0 ? getCached(req.path, req.query, ttl) : null;
    if (hit) return res.json(hit);

    // Assemble the PurpleAir request (set default fields)
    const DEFAULT_FIELDS =
      "latitude,longitude,pm2.5_atm,name,last_seen,humidity,temperature,pressure";
    const url = new URL(`${PA_BASE}/sensors`);
    url.searchParams.set("fields", fields || DEFAULT_FIELDS);

    // Only pass through legal values to avoid 400
    if (location_type === "0" || location_type === "1" || location_type === "both") {
      url.searchParams.set("location_type", location_type);
    }
    if (n && /^\d+$/.test(String(n))) url.searchParams.set("n", String(n));
    if (max_age && /^\d+$/.test(String(max_age))) url.searchParams.set("max_age", String(max_age));
    if (types) url.searchParams.set("types", String(types));

    for (const [k, v] of Object.entries(rest)) {
      if (Array.isArray(v))
        v.forEach(val => val != null && val !== "" && url.searchParams.append(k, val));
      else if (v != null && v !== "") url.searchParams.set(k, v);
    }

    // request former
    const upstream = await fetch(url.toString(), {
      headers: { "X-API-Key": PURPLEAIR_API_KEY },
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error("PurpleAir error", upstream.status, text);

      // 402/429 → back to old cache，labeled stale:true
      if (upstream.status === 402 || upstream.status === 429) {
        const stale = getStale(req.path, req.query);
        if (stale) {
          return res.status(200).json({ ...stale, stale: true });
        }
      }
      return res.status(upstream.status).json({ error: "PurpleAir error", detail: text });
    }

    const json = await upstream.json();
    const rows = normalizeRecords(json);

    //  bbox filter
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
    return res.json(final);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Proxy error", detail: String(e) });
  }
});

// ============  /api/sensors/geojson（based on former） ============
app.get("/api/sensors/geojson", async (req, res) => {
  try {
    // request from /api/sensors
    const self = new URL(`${req.protocol}://${req.get("host")}/api/sensors`);
    for (const [k, v] of Object.entries(req.query)) {
      if (Array.isArray(v)) v.forEach(val => self.searchParams.append(k, val));
      else self.searchParams.set(k, v);
    }

    const resp = await fetch(self.toString());
    if (!resp.ok) {
      const text = await resp.text();
      return res
        .status(resp.status)
        .json({ error: "Upstream /api/sensors error", detail: text });
    }

    const raw = await resp.json();
    const list = normalizeRecords(raw);

    const features = [];
    for (const rec of list) {
      const f = recordToFeature(rec);
      if (f) features.push(f);
    }

    const body = { type: "FeatureCollection", features };
    if (raw?.stale) body.stale = true; // Transparent transmission of stale markers

    return res.json(body);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Proxy error", detail: String(e) });
  }
});

// health check
app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`PurpleAir proxy running on http://localhost:${PORT}`);
});
