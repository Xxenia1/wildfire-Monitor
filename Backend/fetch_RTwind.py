# fetch real-time wind data for wind mode
# %% 
import ee
ee.Initialize(project='canvas-radio-444702-k2')
import json
import tempfile
import shutil
import numpy as np
import xarray as xr
from herbie import Herbie
from datetime import datetime
from google.cloud import storage

# %%
# california = ee.FeatureCollection("TIGER/2018/States") \
#             .filter(ee.Filter.eq("NAME", "California"))

# %%
# Get today's date in YYYYMMDD format
today = datetime.datetime.utcnow().strftime("%Y%m%d")

# create temporary dictionary for file download
temp_dir = tempfile.mkdtemp()
print(f"[INFO] Temporary directory created at: {temp_dir}")

# Fetch the latest HRRR surface data using Herbie
H = Herbie(
    date=today,   # Use today's date
    model="hrrr",
    product="sfc", # model product
    fxx=0,  # Forecast hour (0 = analysis time)
    save_dir=temp_dir #temporary file dictionary
)

# only download 10m wind U/V components
subset_path = H.download(r":[U|V]GRD:10 m above", verbose=True)

# Open dataset and crop to California + Pacific coast 
ds = xr.open_dataset(subset_path, engine="cfgrib")
# set CA boundary box + + westward ocean buffer
lat_min, lat_max = 31, 43
lon_min, lon_max = -127, -113

# crop the region
ds_cropped = ds.sel(
    latitude=slice(lat_max, lat_min),  # north to south
    longitude=slice(lon_min, lon_max)
)
# %% extract wind field
u10 = ds_cropped["u10"].values.tolist()
v10 = ds_cropped["v10"].values.tolist()
lat = ds_cropped["latitude"].values.tolist()
lon = ds_cropped["longitude"].values.tolist()

# Construct JSON object
wind_json = {
    "date": today,
    "u": u10,
    "v": v10,
    "latitude": lat,
    "longitude": lon
}

# %% save to json
json_path = f"{temp_dir}/wind_{today}.json"
with open(json_path, "w") as f:
    json.dump(wind_json, f)

print(f"[INFO] JSON saved: {json_path}")

# %%  Upload to GCS
BUCKET_NAME = "wildfire-monitor-data"
client = storage.Client()
bucket = client.bucket(BUCKET_NAME)
# Upload with timestamp
timestamp_blob = bucket.blob(f"wind_data/wind_{today}.json")
timestamp_blob.upload_from_filename(json_path)
print(f"[GCS] Uploaded as wind_data/wind_{today}.json")

# Upload with fixed name for front-end reference
latest_blob = bucket.blob("wind_data/latest.json")
latest_blob.upload_from_filename(json_path)
print("[GCS] Uploaded as wind_data/latest.json")

# %% clean up temporary file
shutil.rmtree(temp_dir)
print(f"[CLEANUP] Temporary directory deleted: {temp_dir}")