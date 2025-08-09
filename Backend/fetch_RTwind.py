#!pip install herbie-data cfgrib xarray numpy google-cloud-storage earthengine-api

# %%
# %%
import os
import math
import json
import shutil
import tempfile
from datetime import datetime, timedelta, timezone

import numpy as np
import xarray as xr
import requests

# ---------------- config ----------------
# Califorlia bbox（W,S,E,N）
CA_W, CA_S, CA_E, CA_N = -125.0, 32.0, -113.0, 42.5
OCEAN_BUF_DEG = 5.0  # Additional 5° to the west
W = CA_W - OCEAN_BUF_DEG
E = CA_E
S = CA_S
N = CA_N

# Output JSON path
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Data", "Wind")
OUT_JSON = os.path.join(OUT_DIR, "wind_ca_latest.json")

# Select the current UTC offset by a few hours to avoid the "latest file has not been generated" window
now = datetime.utcnow() - timedelta(hours=4)
date_str = now.strftime("%Y%m%d")
hour_str = now.strftime("%H")

# U/V@10m of HRRR F00 (analysis/reporting time)
base_url = f"https://noaa-hrrr-bdp-pds.s3.amazonaws.com/hrrr.{date_str}/conus/hrrr.t{hour_str}z.wrfsfcf00.grib2"
print("[INFO] Downloading:", base_url)

# ---------------- download ----------------
tmpdir = tempfile.mkdtemp()
grib_path = os.path.join(tmpdir, f"hrrr_{date_str}_{hour_str}.grib2")

r = requests.get(base_url, stream=True, timeout=60)
if r.status_code != 200:
    raise RuntimeError(f"Failed to download HRRR: {r.status_code} {base_url}")
with open(grib_path, "wb") as f:
    for chunk in r.iter_content(1 << 15):
        f.write(chunk)
print("[INFO] Saved to:", grib_path)

# ---------------- open GRIB ----------------
# HRRR is a Lambert Conformal grid, and cfgrib gives 2D latitude/longitude
ds = xr.open_dataset(
    grib_path,
    engine="cfgrib",
    backend_kwargs={"filter_by_keys": {"typeOfLevel": "heightAboveGround", "level": 10}},
)

for cand in ("u10", "u"):
    if cand in ds:
        uvar = cand
        break
else:
    raise KeyError("U-wind at 10 m not found (u10/u)")

for cand in ("v10", "v"):
    if cand in ds:
        vvar = cand
        break
else:
    raise KeyError("V-wind at 10 m not found (v10/v)")

# Latitude and longitude coordinate names (cfgrib usually gives 2D 'latitude'/'longitude')
lat2d = ds["latitude"]
lon2d = ds["longitude"]

# longitude 0–360 -> -180–180
lon2d = xr.where(lon2d > 180, lon2d - 360, lon2d)

# ---------------- crop to California bbox ----------------
mask = (lat2d >= CA_S) & (lat2d <= CA_N) & (lon2d >= CA_W) & (lon2d <= CA_E)
# Use where+drop to clip along the y/x dimensions
u_raw = ds[uvar].where(mask)
v_raw = ds[vvar].where(mask)
#The longitude and latitude after synchronous clipping (the dimension name is consistent with the wind farm)
lat_raw = lat2d.where(mask)
lon_raw = lon2d.where(mask)

for dim0, dim1 in ((u_raw.dims[0], u_raw.dims[1]),):
    u_raw  = u_raw.dropna(dim=dim0, how="all").dropna(dim=dim1, how="all")
    v_raw  = v_raw.dropna(dim=dim0, how="all").dropna(dim=dim1, how="all")
    lat_raw = lat_raw.dropna(dim=dim0, how="all").dropna(dim=dim1, how="all")
    lon_raw = lon_raw.dropna(dim=dim0, how="all").dropna(dim=dim1, how="all")

# Count non-empty points to ensure that they are not all empty
valid_u = int(np.isfinite(u_raw.values).sum())
valid_v = int(np.isfinite(v_raw.values).sum())
print(f"[INFO] valid counts: U={valid_u}, V={valid_v}")
if valid_u == 0 or valid_v == 0:
    raise RuntimeError("Cropped HRRR wind is empty — check bbox / hour / projection.")

# ---------------- reorder to (row: north->south, col: west->east) ----------------
# Sort by the average latitude of each row (descending: north -> south), and by the average longitude of each column (ascending: west -> east)
lat_mean_by_row = np.nanmean(lat_raw.values, axis=1)
lon_mean_by_col = np.nanmean(lon_raw.values, axis=0)
row_idx = np.argsort(-lat_mean_by_row)
col_idx = np.argsort(lon_mean_by_col)

u_sorted = u_raw.isel({u_raw.dims[0]: row_idx, u_raw.dims[1]: col_idx})
v_sorted = v_raw.isel({v_raw.dims[0]: row_idx, v_raw.dims[1]: col_idx})
lat_sorted = lat_raw.isel({lat_raw.dims[0]: row_idx, lat_raw.dims[1]: col_idx})
lon_sorted = lon_raw.isel({lon_raw.dims[0]: row_idx, lon_raw.dims[1]: col_idx})

# 再次剔除四周“全 null”的行/列（双保险）
keep_rows = np.where(np.any(np.isfinite(u_sorted.values), axis=1))[0]
keep_cols = np.where(np.any(np.isfinite(u_sorted.values), axis=0))[0]
u_sorted   = u_sorted.isel({u_sorted.dims[0]: keep_rows,   u_sorted.dims[1]: keep_cols})
v_sorted   = v_sorted.isel({v_sorted.dims[0]: keep_rows,   v_sorted.dims[1]: keep_cols})
lat_sorted = lat_sorted.isel({lat_sorted.dims[0]: keep_rows, lat_sorted.dims[1]: keep_cols})
lon_sorted = lon_sorted.isel({lon_sorted.dims[0]: keep_rows, lon_sorted.dims[1]: keep_cols})

ny, nx = u_sorted.shape


# bbox（W,S,E,N）
west = float(np.nanmin(lon_sorted.values))
east = float(np.nanmax(lon_sorted.values))
south = float(np.nanmin(lat_sorted.values))
north = float(np.nanmax(lat_sorted.values))

dx = float((east  - west ) / (nx - 1)) if nx > 1 else 0.0
dy = float((north - south) / (ny - 1)) if ny > 1 else 0.0

print("[INFO] bbox=", [west, south, east, north], " nx,ny=", nx, ny, " dx,dy=", dx, dy)

# ---------------- convert to lists with nulls ----------------
def to_list_with_null(a: np.ndarray):
    # 先把非有限值转换成 np.nan，再转列表，最后把 nan 变成 None（JSON 里是 null）
    arr = np.where(np.isfinite(a), a, np.nan).tolist()
    return [
        [
            None if (x is None or (isinstance(x, float) and math.isnan(x))) else float(x)
            for x in row
        ]
        for row in arr
    ]

u10 = to_list_with_null(u_sorted.values)
v10 = to_list_with_null(v_sorted.values)

# ---------------- build JSON document ----------------
doc = {
    "meta": {
        "bbox": [west, south, east, north],
        "nx": int(nx),
        "ny": int(ny),
        "dx": dx,
        "dy": dy,
        "units": "m/s",
        "timestamp": now.replace(tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "grid_origin": "upper-left"
    },
    "u10": u10,
    "v10": v10
}

# ---------------- write ----------------
os.makedirs(OUT_DIR, exist_ok=True)
with open(OUT_JSON, "w", encoding="utf-8") as f:
    json.dump(doc, f, separators=(",", ":"))

print("[OK] wrote:", OUT_JSON)
print("       bbox=", doc["meta"]["bbox"])
print("       nx,ny=", doc["meta"]["nx"], doc["meta"]["ny"], " dx,dy=", doc["meta"]["dx"], doc["meta"]["dy"])
# %%