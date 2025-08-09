## Use to check the validation of wind data.
"""
Validate gridded wind JSON and produce:
  - Wind/wind_ca_latest.pretty.json  (human-readable)格式化可读版本
  - Wind/wind_ca_latest.stats.json   (summary stats)摘要统计
  - Wind/wind_ca_velocity.json       (leaflet-velocity compatible)兼容版用于前端渲染

Exit code:
  0 -> OK
  1 -> Validation/conversion failed
Usage:
  python Backend/validate_wind.py Wind/wind_ca_latest.json Wind [--null-threshold 0.9]
"""
# %% 
import json, math, sys, os, time, statistics
from pathlib import Path
from datetime import datetime, timezone

CA_BBOX = (-125.0, 32.0, -113.0, 43.5)  # (W,S,E,N) loose bounds for CA

def parse_args(argv):
    in_path = None  # input JSON path
    out_dir = None  # output directory for results
    null_thr = 0.9  # null ratio threshold (default 90%)
    i = 0           # argument index
    while i < len(argv):
        a = argv[i]
        if in_path is None:
            in_path = a
        elif out_dir is None:
            out_dir = a
        elif a in ("--null-threshold", "-t"):
            i += 1
            null_thr = float(argv[i])
        else:
            raise SystemExit(f"Unknown arg: {a}")
        i += 1
    if not in_path or not out_dir:
        raise SystemExit("Usage: python Backend/validate_wind.py <in_json> <out_dir> [--null-threshold 0.9]")
    return in_path, out_dir, null_thr

def isclose(a,b,eps=1e-6): return abs(a-b) <= eps

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def clean_num(x):
    # return float or None
    if x is None: return None
    try:
        v = float(x)
        if math.isfinite(v):
            # Drop absurd values (likely corrupt units)
            if abs(v) > 1e3:
                return None
            return v
    except Exception:
        pass
    return None

def stats_2d(arr2d):
    vals, nnull = [], 0
    ny = len(arr2d) if arr2d else 0
    nx = len(arr2d[0]) if ny else 0
    for r in arr2d:
        for x in r:
            v = clean_num(x)
            if v is None:
                nnull += 1
            else:
                vals.append(v)
    if not vals:
        raise ValueError("all values are null/NaN")
    mn = min(vals); mx = max(vals); mean = sum(vals) / len(vals)
    null_ratio = nnull / (nnull + len(vals))
    return {"min": mn, "max": mx, "mean": mean, "null_ratio": null_ratio}
# %% Check metadata consistency
def check_meta(meta, nx, ny):
    required = ["bbox","nx","ny","dx","dy","units"]
    for k in required:
        if k not in meta:
            raise ValueError(f"meta.{k} missing")
    west,south,east,north = meta["bbox"]
    if not (west < east and south < north):
        raise ValueError("bbox invalid (order should be [W,S,E,N])")
    if meta["nx"] != nx or meta["ny"] != ny:
        raise ValueError("meta nx/ny mismatch with array shapes")
    # Check dx/dy consistency
    exp_dx = (east - west) / (nx - 1) if nx > 1 else meta["dx"]
    exp_dy = (north - south) / (ny - 1) if ny > 1 else meta["dy"]
    if not isclose(exp_dx, meta["dx"], 1e-6):
        raise ValueError(f"dx mismatch: meta.dx={meta['dx']} vs computed={exp_dx}")
    if not isclose(exp_dy, meta["dy"], 1e-6):
        raise ValueError(f"dy mismatch: meta.dy={meta['dy']} vs computed={exp_dy}")
    # Covering the basic scope of California (lenient judgment)
    cw, cs, ce, cn = CA_BBOX
    ow, os_, oe, on_ = west, south, east, north
    intersects = not (oe < cw or ow > ce or on_ < cs or os_ > cn)
    if not intersects:
        raise ValueError("bbox does not intersect California region")
    # Time freshness (adjustable 36h）
    ts = meta.get("timestamp")
    if ts:
        try:
            t = datetime.fromisoformat(ts.replace("Z","+00:00")).astimezone(timezone.utc)
            age_h = (datetime.now(timezone.utc) - t).total_seconds()/3600.0
            if age_h > 36:
                print(f"[WARN] data age {age_h:.1f}h (>36h)")
        except Exception as e:
            print(f"[WARN] parse timestamp failed: {e}")


def speed_bad(mx):
    return mx > 80  # m/s, extreme threshold

def validate_grid(doc):
    # Expectation Structure：{"meta": {...}, "u10":[[...]], "v10":[[...]]}
    if not all(k in doc for k in ("u10","v10")):
        raise ValueError("u10/v10 missing")
    u, v = doc["u10"], doc["v10"]
    ny, nx = len(u), len(u[0]) if u else (0,0)
    if ny == 0 or nx == 0: raise ValueError("empty grid")
    if any(len(row)!=nx for row in u) or any(len(row)!=nx for row in v) or len(v)!=ny:
        raise ValueError("u/v shape mismatch")
    meta = doc.get("meta")
    if not meta:
        raise ValueError("meta missing")
    check_meta(meta, nx, ny)
    su = stats_2d(u); sv = stats_2d(v)

    # Rough check of speed limit
    mx_speed_est = math.sqrt(max(su["max"]**2,1e-9) + max(sv["max"]**2,1e-9))
    if speed_bad(mx_speed_est):
        print(f"[WARN] max speed seems too high: ~{mx_speed_est:.1f} m/s")

    return {
        "nx": nx, "ny": ny,
        "u_stats": su, "v_stats": sv,
        "meta": meta
    }

def to_velocity_json(doc):
    # Convert the mesh to leaflet-velocity compatible JSON (two objects: u, v)
    meta = doc["meta"]; u = doc["u10"]; v = doc["v10"]
    ny, nx = len(u), len(u[0])
    west,south,east,north = meta["bbox"]
    dx, dy = meta["dx"], meta["dy"]
    refTime = meta.get("timestamp","")

    # Flattened (row-major, rows: north->south; columns: west->east)
    flat_u = [val if (val is None or isinstance(val,(int,float))) else None for row in u for val in row]
    flat_v = [val if (val is None or isinstance(val,(int,float))) else None for row in v for val in row]
    header_base = {
        "nx": nx, "ny": ny,
        "lo1": west, "la1": north,  # upper-left
        "lo2": east, "la2": south,  # lower-right
        "dx": dx, "dy": dy,
        "refTime": refTime
    }
    u_obj = {"header": {**header_base, "parameterCategory": 2, "parameterNumber": 2}, "data": flat_u}
    v_obj = {"header": {**header_base, "parameterCategory": 2, "parameterNumber": 3}, "data": flat_v}
    return [u_obj, v_obj]
# %% Main function to validate and convert wind data
def main():
    try:
        # default args for interactive runs (no CLI args)
        if len(sys.argv) == 1:
            repo_root = Path(__file__).resolve().parents[1] if "__file__" in globals() else Path.cwd()
            in_json = (repo_root / "Data" / "Wind" / "wind_ca_latest.json").resolve()
            out_dir = (repo_root / "Data" / "Wind").resolve()
            sys.argv.extend([str(in_json), str(out_dir)])
            print("[INFO] No args detected; using defaults:")
            print("       in_json =", in_json)
            print("       out_dir =", out_dir)

        in_path, out_dir, null_thr = parse_args(sys.argv[1:])
        if not os.path.exists(in_path):
            raise FileNotFoundError(f"input json not found: {in_path}")
        os.makedirs(out_dir, exist_ok=True)

        doc = load_json(in_path)
        summary = validate_grid(doc)

        if summary["u_stats"]["null_ratio"] > null_thr or summary["v_stats"]["null_ratio"] > null_thr:
            raise ValueError(f"too many nulls (>{int(null_thr*100)}%), abort rendering")

        print(f"[OK] grid validated: {summary['nx']}x{summary['ny']}")

        pretty_path = os.path.join(out_dir, "wind_ca_latest.pretty.json")
        with open(pretty_path, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)

        stats_path = os.path.join(out_dir, "wind_ca_latest.stats.json")
        stats = {
            "nx": summary["nx"], "ny": summary["ny"],
            "u": summary["u_stats"], "v": summary["v_stats"],
            "timestamp": summary["meta"].get("timestamp"),
            "units": summary["meta"].get("units"),
            "bbox": summary["meta"].get("bbox")
        }
        with open(stats_path, "w", encoding="utf-8") as f:
            json.dump(stats, f, indent=2)

        vel_path = os.path.join(out_dir, "wind_ca_velocity.json")
        vel = to_velocity_json(doc)
        with open(vel_path, "w", encoding="utf-8") as f:
            json.dump(vel, f, separators=(",",":"))

        # echo absolute paths for sanity
        print("[WRITE] pretty ->", os.path.abspath(pretty_path))
        print("[WRITE] stats  ->", os.path.abspath(stats_path))
        print("[WRITE] vel    ->", os.path.abspath(vel_path))
        print("[OK] wrote pretty/stats/velocity json")
        sys.exit(0)

    except Exception as e:
        print("[FAIL]", e)
        sys.exit(1)

if __name__ == "__main__":
    main()
# %%
