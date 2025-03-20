# fetch real-time fire data for fire mode

# %% python visualize
import ee
import json
import requests
import xarray as xr
from google.cloud import storage
from datetime import datetime, timedelta, timezone

ee.Initialize(project='canvas-radio-444702-k2') ## initialize GEE with a exist project

# %% get UTC time
now = datetime.now(timezone.utc)
start_time = now - timedelta(hours=24)

##print(f"Current UTC Time: {now}")
##print(f"Start Time (24h ago): {start_time}")

## convert time to string
start_time_str = start_time.strftime('%Y-%m-%dT%H:%M:%S')
end_time_str = now.strftime('%Y-%m-%dT%H:%M:%S')

# %% fetch real-time fire data, using VIIRS
## set boundary
##california = ee.FeatureCollection("TIGER/2018/States") \
            ##.filter(ee.Filter.eq("NAME", "California"))
us = ee.FeatureCollection("TIGER/2018/States") \

# %% try different dataset
noaa_viirs = ee.ImageCollection('NASA/LANCE/NOAA20_VIIRS/C2') \
                .filter(ee.Filter.date(start_time_str, end_time_str)) \
                .filterBounds(us)


## get the latest one 
latest_fire = noaa_viirs.first()

# %% convert image to geojson and save it
# Convert fire image to vector points
if latest_fire.getInfo() is None:
    print("No fire data found in the United States in the past 24 hours.") ## for now, there's no active fire activities in CA
else:
    # Convert fire image to vector points
    fire_vectors = latest_fire.reduceToVectors(
        reducer=ee.Reducer.countEvery(),
        geometryType='centroid',  # Convert fire pixels to points
        scale=375,
        maxPixels=1e13
    )

    # Convert to GeoJSON
    fire_geojson = fire_vectors.getInfo()

    # Save as JSON
    output_file = "Data/UpToDate_fire_NOAA.json"
    with open(output_file, "w") as f:
        json.dump(fire_geojson, f, indent=4)

    print('Done')
# %%
