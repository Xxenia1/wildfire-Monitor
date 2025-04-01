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

# %% set parameters
time_window_hours = 72  
now = datetime.now(timezone.utc)
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

# %% define title to divide the boundary
    tiles = [
        ee.Geometry.Rectangle([-125, 32, -110, 42]),  # CA/NV/OR
        ee.Geometry.Rectangle([-110, 32, -90, 42]),   # AZ/NM/TX/OK
        ee.Geometry.Rectangle([-125, 42, -100, 50]),  # WA/MT/ID/WY
        ee.Geometry.Rectangle([-100, 42, -80, 50])    # Midwest
    ]
    # export catalog
    os.makedirs("../Data", exist_ok=True)
    timestamp = now.strftime("%Y%m%d")
    all_features = []

    for i, tile in enumerate(tiles):
        print(f"Processing tile {i+1}/{len(tiles)}...")
        try:
            fire_vectors = merged_image.reduceToVectors(
                reducer=ee.Reducer.countEvery(),
                geometry=tile,
                geometryType='centroid',
                scale=1000,
                maxPixels=1e13
            )
            geojson = fire_vectors.getInfo()
            all_features.extend(geojson['features'])
        except Exception as e:
            print(f"Tile {i+1} failed: {e}")

    if all_features:
        final_geojson = {
            "type": "FeatureCollection",
            "features": all_features
        }

        output_file = f"../Data/fires_merged_tiled_{timestamp}.geojson"
        with open(output_file, "w") as f:
            json.dump(final_geojson, f, indent=4)
        print(f"Saved combined tiles to: {output_file}")


# %% export to GCS

# Set up your Google Cloud Storage details
BUCKET_NAME = 'wildfire-monitor-data'
# Generate timestamp dynamically 
timestamp = datetime.now().strftime("%Y%m%d")
# file path
DESTINATION_BLOB_NAME = f'RT_fire_data/fires_merged_tiled_{timestamp}.geojson'  
SOURCE_FILE_NAME = f'../Data/fires_merged_tiled_{timestamp}.geojson'  

# Function to upload file to GCS
def upload_to_gcs(bucket_name, source_file_name, destination_blob_name):
    #Uploads a file to the Google Cloud Storage bucket.
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)

    blob.upload_from_filename(source_file_name)

    print(f"File {source_file_name} uploaded to {destination_blob_name} in bucket {bucket_name}.")

# Execute upload
upload_to_gcs(BUCKET_NAME, SOURCE_FILE_NAME, DESTINATION_BLOB_NAME)


# %%
