# fetch real-time fire data for fire mode

# %% python visualize
import ee
import os
import json
import requests
import xarray as xr
from google.cloud import storage
from datetime import datetime, timedelta, timezone

ee.Initialize(project='canvas-radio-444702-k2') ## initialize GEE with a exist project
storage_client = storage.Client()
# set GCS bucket
BUCKET_NAME = "wildfire-monitor-data"

# %% set parameters
time_window_hours = 72  
now = datetime.now(timezone.est) # change time zone to EST
start_time = now - timedelta(hours=time_window_hours)

## convert time to string
start_time_str = start_time.strftime('%Y-%m-%dT%H:%M:%S')
end_time_str = now.strftime('%Y-%m-%dT%H:%M:%S')

# %% fetch real-time fire data, using VIIRS
## set boundary (whole states)

us = ee.FeatureCollection("TIGER/2018/States")

# %% try different dataset
noaa_viirs = ee.ImageCollection('NASA/LANCE/NOAA20_VIIRS/C2') \
                .filter(ee.Filter.date(start_time_str, end_time_str)) \
                .filterBounds(us)


## get the latest one 
count = noaa_viirs.size().getInfo()
print(f"VIIRS image count in the past {time_window_hours}h: {count}")

# %% convert image to geojson and save it
# Convert fire image to vector points
if count == 0:
    print(" No VIIRS fire image found.")
else:
    # aggregate high confidence areas of all images
    def mask_confident(img):
        image = ee.Image(img).select('confidence')
        return image.updateMask(image.eq(1))
    # convert images to list
    fires_list = noaa_viirs.toList(count)
    masked_images = fires_list.map(mask_confident)
    merged_image = ee.ImageCollection(masked_images).mosaic()

# %% define tiles to divide the boundary
    tiles = [
        ee.Geometry.Rectangle([-125, 32, -110, 42]),  # CA/NV/OR
        ee.Geometry.Rectangle([-110, 32, -90, 42]),   # AZ/NM/TX/OK
        ee.Geometry.Rectangle([-125, 42, -100, 50]),  # WA/MT/ID/WY
        ee.Geometry.Rectangle([-100, 42, -80, 50])    # Midwest
    ]
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    all_features = []
    # fetch data
    for i, tile in enumerate(tiles):
        print(f"Exporting tile {i+1}/{len(tiles)}...")

    # reduce raster data to vectors
    fire_vectors = merged_image.reduceToVectors(
        reducer=ee.Reducer.countEvery(),
        geometry=tile,
        geometryType='centroid',
        scale=1000,
        maxPixels=1e13
    )

    # define file path on GCS
    file_name = f"RT_fire_data/fires_tile_{i+1}_{timestamp}.geojson"

    # export to Google Cloud Storage directly
    task = ee.batch.Export.table.toCloudStorage(
        collection=fire_vectors,
        description=f"RT_fire_export_tile_{i+1}_{timestamp}",
        bucket=BUCKET_NAME,
        fileFormat="GeoJSON",
        path=file_name
    )
    task.start()

    print(f"Tile {i+1} export started.")

# %%
