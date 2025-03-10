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
from herbie import Herbie

# %%
# set CA boundary
california = ee.FeatureCollection("TIGER/2018/States") \
            .filter(ee.Filter.eq("NAME", "California"))

# %%
# Get today's date in YYYYMMDD format
today = datetime.datetime.utcnow().strftime("%Y%m%d")

#Fet ch the most recent HRRR dataset
H = Herbie(
    date=today,   # Use today's date
    model="hrrr",
    product="sfc",
    fxx=0  # Forecast hour (0 = analysis time)
)

# Check available data fields
print("Available HRRR Data Fields:")
print(H.inventory())
print("Herbie expects the file at:", H.get_localFilePath())
# Download the full HRRR file
H.download()
# %%

# %%
