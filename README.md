# California Wildfire Monitoring Platform
## Brief Introduction:
- The wildfire monitoring platform aims to provide an interactive, real-time monitoring platform for tracking wildfires, wind speed, and smoke dispersion in California. 
- By leveraging *Google Earth Engine (GEE)* as backend with a series of functions extracting, preparing, loading, and manipulating all satellite data. At the front end of this project, it mainly utilizes *leaflet.js* and *D3.js* implement all visualizations.

### Audience:
1. Researchers who study wildfire behavior and trends.
2. Emergency angencies: like firefighters and their management team can use this real-time fire tracking for response planning.
3. Individuals who concerned about real-time wildfire conditions.

### Region/Study Area: California
## Data:
All satellite data can be used directly in GEE, because it combines a multi-petabyte catalog of satellite imagery:

| Data | Data Source | Usage |
|----------|----------|----------|
| GOES ABI | [GOES-16 FDCC Series ABI Level 2 Fire/Hot Spot Characterization CONUS](https://developers.google.com/earth-engine/datasets/catalog/NOAA_GOES_16_FDCC) | Displaying historical wildfire data |
| VIIRS | [VJ114IMGTDL_NRT Daily Raster: VIIRS (NOAA-20) Band 375m Active Fire](https://developers.google.com/earth-engine/datasets/catalog/NASA_LANCE_NOAA20_VIIRS_C2) | Used for detecting real-time wildfire data, and it updates per day.  |
| NDVI Time-Series | [Harmonized Sentinel-2 MSI: MultiSpectral Instrument, Level-2A (SR)](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED) | Used for displaying NDVI time series. (2013~present) |

Wind data: using [NOAA AWS S3 Public Repository](https://registry.opendata.aws/noaa-hrrr-pds/) to fetch hourly High_Resolution Rapid Refresh (HRRR) data.

Smoke data: using [PurpleAir API Key](https://develop.purpleair.com/) to fetch 

## Deliverable:
The final deliverable is an interactive web-based wildfire monitoring system that displays real-time wildfire activities, wind patterns, and smoke dispersion with the ability to switch between different data layers. It includes several modes:

1. Fire mode: display real-time wildfire locations using VIIRS data, which updates ever 12 hours.
- Active fire hotspots: display as fire icons. And users can click each fire point to learn fire size, detection time, source, etc.
-  Display the affected area of ongoing/historical fires.
- Time slider tool: updates historical fire (since 2019) data dynamically. 
2. Wind mode: overlays animated wind speed and direction from NOAA HRRR, which updates every hour. 
- Animated wind particles flow in the direction of wind movement.
- The speed of particles depends on the wind speed.
- Opacity and color intensity represent wind strength.
- Users can toggle on/off.
3. Smoke mode: shows smoke dispersion from NOAA HRRR Smoke, which updates every hour.
- A semi-transparent gradient overlay shows smoke concentration.
- Darker areas indicate higher smoke density.
- Users can toggle on/off.
4. NDVI time-series: animates NDVI changes over time. (2024~present)
- Once select , the animation will display on the side bar along with D3 line chart (vegetation index over time).
5. Interactive controls: 
- Layer toggles: users can switch between fire, wind, and smoke modes.
- Search bar: allow users to search for a specific location (like city, county), then automatically zooms to the selected area.
- Time slider: allow users to view historical fire data dynamically.




