# fetch historical fire data for fire mode
# %% python visualize
import ee
import pandas as pd
# %%
ee.Initialize(project='canvas-radio-444702-k2')
# %% set data range
START_DATE = "2019-01-01"
END_DATE = "2025-01-31"
# set CA boundary
california = ee.FeatureCollection("TIGER/2018/States") \
            .filter(ee.Filter.eq("NAME", "California"))
# %% fetch GOES ABI 
