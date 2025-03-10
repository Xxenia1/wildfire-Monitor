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
# define URL
base_url = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/hrrr/prod/hrrr.YYYYMMDD/hrrr.t{HH}z.wrfsfcf00.grib2"

# Get latest available hour (e.g., "12" for 12 UTC)
hour = "12"  # Change this dynamically if needed
url = base_url.format(hour=hour)

# Define output file
file_name = "realtime_wind_data.grib2"

# Download the GRIB2 file
print(f"Downloading real-time HRRR wind data from {url} ...")
response = requests.get(url, stream=True)
if response.status_code == 200:
    with open(file_name, "wb") as f:
        f.write(response.content)
    print(f"Downloaded successfully: {file_name}")
else:
    print(f"Failed to download HRRR data. Status code: {response.status_code}")
    exit()
# %%

# %%
