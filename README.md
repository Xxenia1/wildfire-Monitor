# California Wildfire Monitoring Platform
## Brief Introduction:
- The wildfire monitoring platform aims to provide an interactive, real-time monitoring platform for tracking real-time wildfires, wind speed/direction, smoke dispersion, and vegetation health in California. 
- By leveraging *Google Earth Engine (GEE)* as backend for ingesting and processing **NASA VIIRS** fire detections, **Sentinel-2 NDVI time series**, **NOAA HRRR** wind & smoke models, along with real-time **CAL FIRE/NIFC FIRS** and **PurpleAir API** streams automated via GitHub Actions.
- At the front end, the dashboard employs *Leaflet.js* for interactive mapping, *D3.js* for dynamic charts and animations, and *turf.js* for spatial analyses—generating predictive fire-spread buffers, urban-impact overlays, and population-risk estimations.
### Audience:
1. Researchers who study wildfire behavior and trends.
2. Emergency officials: like firefighters and their management team can use this real-time fire tracking for response planning.
3. Individuals who are concerned about real-time wildfire conditions.

### Region/Study Area: California
## Data:
All satellite data can be used directly in GEE, because it combines a multi-petabyte catalog of satellite imagery:

| Data Category | Data Source & Link | Usage |
|----------|----------|----------|
| Real-time Wildfire Detections | CAL FIRE/NIFC FIRS API <br>[NASA VIIRS VNP13A1](https://developers.google.com/earth-engine/datasets/catalog/NASA_VIIRS_002_VNP13A1) | Fetches active fire points and displays them on the map |
| Historical Fire Perimeters | CAL FIRE/NIFC | Displays historical fire boundary polygons                 |
| Wind Data | [NOAA AWS S3 Public Repository](https://registry.opendata.aws/noaa-hrrr-pds/)(10 m U/V)<br>Hourly updates | Canvas/WebGL particle animation; hover shows speed/direction|
| Smoke Data | Ground PM₂.₅ / AQI [PurpleAir API](https://developer.purpleair.com/) | Live PM₂.₅ heatmap matched to EPA AQI breakpoints|
| NDVI Time-Series | [Harmonized Sentinel-2 MSI: MultiSpectral Instrument, Level-2A (SR)](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED) | Used for displaying NDVI time series. (2013~present) |
| Population Raster | US Census Bureau | Zonal statistics to estimate population at risk|
| City Boundaries | OpenStreetMap | Overlays predicted fire zones to identify at-risk cities |

## Deliverable:
The final deliverable is an interactive web-based wildfire monitoring system that displays real-time wildfire activities, wind patterns, and smoke dispersion with the ability to switch between different data layers. It includes four modes and three built-in impact analyses:

1. Fire mode: overlays real-time fire detections (active fires and perimeters) from the CAL FIRE FIRS API Key and VIIRS satellite imagery. 
- Each fire is represented by a point feature, placed at its geolocation.
-  Point size corresponds to Fire Radiative Power (FRP) or confidence level, allowing users to see which fires are most intense.
- Color ramp (yellow → orange → red) indicates fire age (new detections in yellow, older detections in red) or burn severity, depending on data source.
- Interactive popup provides detailed metadata for each fire: e.g., detection timestamp, FRP value, confidence score, geolocation.
2. Wind mode: overlays animated wind speed and direction from NOAA HRRR, which updates every hour. 
- On top of the basemap, a full‐screen Canvas (or WebGL) layer renders “wind particles” that move continuously in the direction of the local wind vector.
- Particles are seeded randomly across the viewport; each particle’s velocity is interpolated from the nearest grid‐point U/V values (bilinear interpolation).
- Speed: a particle’s motion speed is proportional to the local wind speed
- Opacity & length: stronger winds produce longer tails and brighter (less transparent) trail segments; lighter winds appear as short, faint streaks.
- Users can toggle on/off. Also, users can hover over any point on the map briefly displays a small popup with the exact interpolated wind speed and direction at that location.
3. Smoke mode: shows smoke dispersion from NOAA HRRR Smoke, which updates every hour.
- Point-based heatmap (PurpleAir API): Convert live PM2.5 readings to a leaflet heatmap, which color ramp corresponds to the EPA AQI breakpoints, giving a localized view of “actual” smoke conditions at ground level.
- Users can toggle on/off.
4. NDVI time-series: animates NDVI changes over time. (2024~present)
- Once select , the animation will display on the side bar along with D3 line chart (vegetation index over time).
5. Interactive controls: 
- Layer toggles: users can switch between fire, wind, and smoke modes.
- Search bar: allow users to search for a specific location (like city, county), then automatically zooms to the selected area.
- Color ramp legend: toggling the “Legend” button shows or hides a vertical color bar.
- Popup on Click/Hover: to show the details of each feature.




