# fetch historical fire data for fire mode
# %% python visualize
import ee
import json
import geemap
import pandas as pd
from google.cloud import storage

# %%
ee.Initialize(project='canvas-radio-444702-k2')
# set GCS bucket 
BUCKET_NAME = "wildfire-monitor-data"

# set CA boundary
california = ee.FeatureCollection("TIGER/2018/States") \
            .filter(ee.Filter.eq("NAME", "California"))
# %% fetch GOES ABI 
def fetch_and_store_fire_data(year):
    # set time range
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"

    # get data 
    fires = ee.ImageCollection("NOAA/GOES/16/FDCC") \
        .filterDate(start_date, end_date) \
        .filterBounds(california) \
        .select(["Area"])  # 

    # convert raster to vector
    def extract_fire_features(image):
        timestamp = ee.Date(image.get("system:time_start")).format("YYYY-MM-dd HH:mm:ss")
        single_band = image.select("Area")

        fire_pixels = single_band.reduceToVectors(
            geometry=california.geometry(),
            scale=2000,  # 2km
            geometryType="centroid",
            reducer=ee.Reducer.countEvery()
        ).map(lambda feature: feature.set("timestamp", timestamp))  # add time info

        return fire_pixels

    fire_features = fires.map(extract_fire_features).flatten()

    # save path
    file_name = f"fire_data/fire_data_{year}.geojson"
    print(f" Exporting {year} fire data to {file_name}...")

    # export to GCS
    task = ee.batch.Export.table.toCloudStorage(
        collection=fire_features,
        description=f"fire_data_export_{year}",
        bucket=BUCKET_NAME,
        fileFormat="GeoJSON",
        path=file_name
    )
    task.start()
    print(f" {year} Done! ")

# loop 2019 to 2025
for year in range(2019, 2026):
    fetch_and_store_fire_data(year)

# %%