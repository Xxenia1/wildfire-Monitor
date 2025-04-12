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
now = datetime.now(timezone.utc) 
start_time = now - timedelta(hours=time_window_hours)

## convert time to string
start_time_str = start_time.strftime('%Y-%m-%d')
end_time_str = now.strftime('%Y-%m-%d')
timestamp = now.strftime('%Y%m%d')

# %% fetch real-time fire data, using VIIRS
## define coundaries and administrative datasets
us = ee.FeatureCollection("TIGER/2018/States")

# CA counties
counties = ee.FeatureCollection("TIGER/2018/Counties")\
             .filter(ee.Filter.eq('STATEFP', '06'))
# CA cities
cities = ee.FeatureCollection("TIGER/2018/Places") \
    .filter(ee.Filter.eq('STATEFP', '06'))

# %% try different dataset
suomi_viirs = ee.ImageCollection("NASA/LANCE/SNPP_VIIRS/C2") \
                .filter(ee.Filter.date(start_time_str, end_time_str)) \
                .filterBounds(us)


## get the latest one 
count = suomi_viirs.size().getInfo()
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
    fires_list = suomi_viirs.toList(count)
    masked_images = fires_list.map(mask_confident)
    merged_image = ee.ImageCollection(masked_images).mosaic()

# %% define tiles to divide the boundary
    tiles = [
        ee.Geometry.Rectangle([-125, 32, -110, 42]),  # CA/NV/OR
        ee.Geometry.Rectangle([-110, 32, -90, 42]),   # AZ/NM/TX/OK
        ee.Geometry.Rectangle([-125, 42, -100, 50]),  # WA/MT/ID/WY
        ee.Geometry.Rectangle([-100, 42, -80, 50])    # Midwest
    ]

    def attach_admin_info(feature):
        county = counties.filterBounds(feature.geometry()).first()
        city = cities.filterBounds(feature.geometry()).first()
        return feature \
            .set('county_name', ee.Algorithms.If(county, county.get('NAME'), None)) \
            .set('city_name', ee.Algorithms.If(city, city.get('NAME'), None))
    
    #timestamp = datetime.now().strftime("%Y%m%d")
    #all_features = []


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
    fire_vectors_with_address = fire_vectors.map(attach_admin_info)

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
