# fetch NDVI image (2024~2025)
# %% import package
import ee
import datetime
import json
import os
from google.cloud import storage

# configration
ee.Initialize(project='canvas-radio-444702-k2') ## initialize GEE with a exist project
storage_client = storage.Client()
BUCKET_NAME = "wildfire-monitor-data"

# %%
start_date = ee.Date('2024-01-01')
end_date   = ee.Date(datetime.datetime.utcnow().strftime('%Y-%m-%d'))
states     = ee.FeatureCollection('TIGER/2018/States')
california = states.filter(ee.Filter.eq('NAME', 'California')).geometry()
# %% sentinel-2
## define cloud mask function
def maskS2clouds(image):
    # QA60 band contains cloud & cirrus mask information
    qa = image.select('QA60')
    cloudBitMask  = 1 << 10  # bit 10 = clouds
    cirrusBitMask = 1 << 11  # bit 11 = cirrus
    # if both bit = 0, represents no cloud
    mask = qa.bitwiseAnd(cloudBitMask).eq(0).And(
           qa.bitwiseAnd(cirrusBitMask).eq(0))
    return image.updateMask(mask)

ndvi_col = (
    ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterDate(start_date, end_date)
      .filterBounds(california)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .map(maskS2clouds)                             
      .map(lambda img:                             
           img.normalizedDifference(['B8','B4'])    # compute  NDVI
              .rename('NDVI')
              .copyProperties(img, ['system:time_start'])
      )
)
# %% upload to GCS
def export_ndvi(image):
    date_str = ee.Date(image.get('system:time_start')).format('YYYYMMdd').getInfo()
    task = ee.batch.Export.image.toCloudStorage(
        image=image.clip(california),
        description=f'Export_NDVI_{date_str}',
        bucket=BUCKET_NAME,
        fileNamePrefix=f'ndvi/ndvi_{date_str}',
        region=california,
        scale=30,
        maxPixels=1e13
    )
    task.start()
    print(f'▶️ 启动导出任务 Export_NDVI_{date_str}')

# 将 ImageCollection 转 List 后逐张导出
count = ndvi_col.size().getInfo()
for i in range(count):
    export_ndvi(ee.Image(ndvi_col.toList(count).get(i)))
# %% 检查：
from google.cloud import storage
storage_client = storage.Client()
bucket = storage_client.bucket(BUCKET_NAME)
print(bucket.exists())

# %%
