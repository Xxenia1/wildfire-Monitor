# fetch historical fire data for fire mode
# %% python visualize
import ee
import json
import geemap
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
fires = ee.ImageCollection("NOAA/GOES/16/FDCC") \
    .filterDate(START_DATE, END_DATE) \
    .filterBounds(california) \
    .select(["Area", "Temp", "Power"])  # Selecting key fire attributes

# Function to extract fire pixels
def extract_fire_features(image):
    # Get timestamp
    timestamp = ee.Date(image.get("system:time_start")).format("YYYY-MM-dd HH:mm:ss")
    
    # Reduce image to feature collection (fire pixels)
    fire_pixels = image.reduceToVectors(
        geometry=california.geometry(),
        scale=2000,  # 2 km resolution
        geometryType="centroid",
        eightConnected=False,
        labelProperty="system:index"
    ).map(lambda feature: feature.set("timestamp", timestamp))  # Add timestamp

    return fire_pixels
# %% Apply the extraction function to the image collection
fire_features = fires.map(extract_fire_features).flatten()

# Convert to GeoJSON format
fire_geojson = geemap.ee_to_geojson(fire_features)

# Convert to Pandas DataFrame
df = pd.DataFrame([feature["properties"] for feature in fire_geojson["features"]])

# Save as CSV and GeoJSON
df.to_csv("historical_fire_data_CA.csv", index=False)

with open("historical_fire_data_CA.geojson", "w") as f:
    json.dump(fire_geojson, f)

print("Historical fire data saved as 'historical_fire_data_CA.csv' and 'historical_fire_data_CA.geojson'.")

# %%