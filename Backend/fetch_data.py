# fetch fire mode data

# %% python visualize
import ee
import json

ee.Initialize(project='canvas-radio-444702-k2')

# %% fetch real-time fire data, using VIIRS
noaa_viirs = ee.ImageCollection('NASA/LANCE/NOAA20_VIIRS/C2') \
            .filterDate(ee.Date.today().advance(-12, 'hour'), ee.Date.today()) \
            .select(['FireMask'])

## convert imagery to vector point
fire_vectors = noaa_viirs.reduceToVectors(
    reducer=ee.Reducer.countEvery(),
    geometryType='centroid',  ## convert to point
    scale=375,  # 375m resolution
    maxPixels=1e13
)

## convert to geojson
fire_geojson = fire_vectors.getInfo()

output_file = "Data/real_fire.json" ## save 
with open(output_file, "w") as f:
    json.dump(fire_geojson, f, indent=4)
print('Done')

# %%
