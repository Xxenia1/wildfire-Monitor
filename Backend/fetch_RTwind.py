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
    product="sfc", # model product
    fxx=0  # Forecast hour (0 = analysis time)
)

# Download the full HRRR file
H.download()
# %%
H.grib # path
H.inventory() # look at GRIB2 file contents
# %%
H.inventory(r":[U|V]GRD:10 m above")

# %%
ds = H.xarray(r":[U|V]GRD:10 m above")
print(ds)
# %%

# %%
mySubset = H.download(r":[U|V]GRD:10 m above", verbose=True)
mySubset
# %% read subset
subset_file = "/Users/xeniax/data/hrrr/20250310/subset_47ef391b_hrrr.t00z.wrfsfcf00.grib2"
#open dataset
#ds = xr.open_dataset(subset_file, engine="cfgrib")
#print(ds)
# %%
