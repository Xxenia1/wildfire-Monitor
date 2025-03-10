# fetch real-time wind data for wind mode
# %% 
import ee
ee.Initialize(project='canvas-radio-444702-k2')
# %%
import requests
import json
import os
import datetime
import xarray as xr

# %%
# set CA boundary
california = ee.FeatureCollection("TIGER/2018/States") \
            .filter(ee.Filter.eq("NAME", "California"))


# %% fetch real-time wind data from HRRR
# Get current UTC time
now = datetime.datetime.utcnow()
date_str = now.strftime("%Y%m%d")  # Format: YYYYMMDD
hour_str = now.strftime("%H")  # Format: HH (UTC hour)

# NOAA HRRR URL format (Updated)
base_url = f"https://nomads.ncep.noaa.gov/pub/data/nccf/com/hrrr/prod/hrrr.YYYYMMDD/conus/hrrr.tHHz.wrfsfcf00.grib2"

# Define output file
file_name = "realtime_wind_data.grib2"

print(f" Attempting to download HRRR data from: {base_url}")

response = requests.get(base_url, stream=True)

if response.status_code == 200:
    with open(file_name, "wb") as f:
        f.write(response.content)
    print(f" Successfully downloaded HRRR data: {file_name}")
else:
    print(f" Failed to download HRRR data. Status code: {response.status_code}")
    exit()

# %%

# %%
