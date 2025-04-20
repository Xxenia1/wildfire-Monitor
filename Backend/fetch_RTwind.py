#!pip install herbie-data cfgrib xarray numpy google-cloud-storage earthengine-api

# %%
import os
import xarray as xr
import numpy as np
import requests
import json
import tempfile
from datetime import datetime,timedelta

# %% define date and bounding box
now = datetime.utcnow() - timedelta(hours=4)
date_str = now.strftime('%Y%m%d')
hour_str = now.strftime('%H')  # earliest available run

# %% construct HRRR file url on aws
base_url = (
    f"https://noaa-hrrr-bdp-pds.s3.amazonaws.com/hrrr.{date_str}/conus/hrrr.t{hour_str}z.wrfsfcf00.grib2"
)
print(f"Downloading from: {base_url}")

# %% create temporary dictionary for file download

temp_dir = tempfile.mkdtemp()
local_path = os.path.join(temp_dir, f"hrrr_{date_str}.grib2")

r = requests.get(base_url, stream=True)
if r.status_code == 200:
    with open(local_path, 'wb') as f:
        for chunk in r.iter_content(8192):
            f.write(chunk)
    print(f" Downloaded to {local_path}")
else:
    raise Exception(f" Failed to download HRRR file: {base_url}")

# %% read file
ds = xr.open_dataset(
    local_path, 
    engine="cfgrib", 
    backend_kwargs={
        "filter_by_keys": {
            "typeOfLevel": "heightAboveGround",
            "level": 10
        }
    }
)
print(ds)
# Convert 0–360 longitude to -180–180
ds["longitude"] = xr.where(ds["longitude"] > 180, ds["longitude"] - 360, ds["longitude"])
# define bounding box
lat_min, lat_max = 25, 50
lon_min, lon_max = -130, -110  # western US

#build mask
lat = ds["latitude"]
lon = ds["longitude"]

lat_mask = (lat >= lat_min) & (lat <= lat_max)
lon_mask = (lon >= lon_min) & (lon <= lon_max)
geo_mask = lat_mask & lon_mask

ds_cropped = ds.where(geo_mask, drop=True)

print(" u10 valid count:", xr.where(ds_cropped["u10"].notnull(), 1, 0).sum().item())
print(" v10 valid count:", xr.where(ds_cropped["v10"].notnull(), 1, 0).sum().item())

# %% create json
u10 = ds_cropped["u10"].values.tolist()
v10 = ds_cropped["v10"].values.tolist()
lat_out = ds_cropped["latitude"].values.tolist()
lon_out = ds_cropped["longitude"].values.tolist()

# create json structure
json_path = os.path.join(temp_dir, f"{date_str}_wind.json")

wind_json = {
    "date": date_str,
    "u10": u10,
    "v10": v10,
    "latitude": lat_out,
    "longitude": lon_out
}
with open(json_path, "w") as f:
    json.dump(wind_json, f)
# %% upload to GCS
from google.cloud import storage
client = storage.Client()

bucket_name = 'wildfire-monitor-data'
destination_blob_name = f'wind/{date_str}_wind.json'

bucket = client.bucket(bucket_name)
# %%
blob = bucket.blob(destination_blob_name)
blob.upload_from_filename(json_path)
print(f"Uploaded to GCS: gs://{bucket_name}/{destination_blob_name}")
# %%
