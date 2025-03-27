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
## set boundary

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
    print(" No VIIRS fire image found. Try increasing the time window or using FIRMS/MODIS.")
else:
    # Convert images to list
    fires_list = noaa_viirs.toList(count)

    # Create local directory if needed
    os.makedirs("Data", exist_ok=True)

    for i in range(count):
        image = ee.Image(fires_list.get(i)).select('confidence')
        mask = image.eq(1) # keep norminal and high confidence
        masked_image = image.updateMask(mask)
        
        # Reduce to fire vectors
        fire_vectors = masked_image.reduceToVectors(
            reducer=ee.Reducer.countEvery(),
            geometry=us.geometry(),
            geometryType='centroid',
            scale=375,
            maxPixels=1e13
        )

        fire_geojson = fire_vectors.getInfo()

        # Generate timestamp-based filename
        timestamp = image.date().format("YYYYMMdd_HHmmss").getInfo()
        output_file = f"Data/fire_NOAA_{timestamp}.geojson"

        # Save locally
        with open(output_file, "w") as f:
            json.dump(fire_geojson, f, indent=4)
        print(f" Saved: {output_file}")

# %% Upload to GCS
        def upload_to_gcs(bucket_name, source_file_path, destination_blob_name):
            client = storage.Client()
            bucket = client.get_bucket(bucket_name)
            blob = bucket.blob(destination_blob_name)
            blob.upload_from_filename(source_file_path)
            print(f"☁️ Uploaded to gs://{bucket_name}/{destination_blob_name}")

        # Customize your GCS bucket here
        bucket_name = "wildfire-monitor-data"  
        destination_blob_name = f"fire-data/{os.path.basename(output_file)}"

        upload_to_gcs(bucket_name, output_file, destination_blob_name)
