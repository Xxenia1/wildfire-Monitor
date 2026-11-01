# California Wildfire Monitoring Platform

## Data updates
The live layers use shared files produced by scheduled GitHub Actions jobs. Fire snapshots are fetched about every 30 minutes, EPA AirNow smoke observations about every hour, and wind once a day. Browsers only read these files and display their data time. The NDVI animation is historical (2024). See [the rollout and operations plan](docs/rollout-plan.zh-CN.md) for setup, quota checks, and failure recovery.


## Credentials
Set `FIRMS_KEY` and `AIRNOW_API_KEY` as GitHub Actions repository secrets. The website's Smoke mode reads the scheduled AirNow snapshot. `Backend/fetch_smoke.py` remains an optional manual archive utility and is not used by the website. Never commit real keys or complete API request URLs.

## Brief Introduction:
- The dashboard maps recent wildfire detections, wind, PM₂.₅ monitoring-site observations, and historical vegetation imagery for California.
- Scheduled GitHub Actions jobs collect NASA FIRMS VIIRS fire detections, WFIGS perimeters, CAL FIRE incidents, NOAA HRRR wind, and EPA AirNow PM₂.₅ monitoring-site observations. NDVI imagery is displayed from historical files.
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
| Smoke Data | [EPA AirNow API](https://docs.airnowapi.org/webservices) monitoring-site PM₂.₅ AQI | Hourly observation points colored by reported AQI |
| NDVI Time-Series | [Harmonized Sentinel-2 MSI: MultiSpectral Instrument, Level-2A (SR)](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED) | Used for displaying NDVI time series. (2013~present) |
| Population Raster | US Census Bureau | Zonal statistics to estimate population at risk|
| City Boundaries | OpenStreetMap | Overlays predicted fire zones to identify at-risk cities |

## Deliverable:
The dashboard lets visitors switch between four layers: recent fire activity, wind, PM₂.₅ observations, and historical NDVI imagery.

1. Fire mode: overlays real-time fire detections (active fires and perimeters) from the CAL FIRE FIRS API Key and VIIRS satellite imagery. 
- Each fire is represented by a point feature, placed at its geolocation.
-  Point size corresponds to Fire Radiative Power (FRP) or confidence level, allowing users to see which fires are most intense.
- Color ramp (yellow → orange → red) indicates fire age (new detections in yellow, older detections in red) or burn severity, depending on data source.
- Interactive popup provides detailed metadata for each fire: e.g., detection timestamp, FRP value, confidence score, geolocation.
2. Wind mode: overlays animated wind speed and direction from NOAA HRRR; the scheduled snapshot updates daily.
- On top of the basemap, a full‐screen Canvas (or WebGL) layer renders “wind particles” that move continuously in the direction of the local wind vector.
- Particles are seeded randomly across the viewport; each particle’s velocity is interpolated from the nearest grid‐point U/V values (bilinear interpolation).
- Speed: a particle’s motion speed is proportional to the local wind speed
- Opacity & length: stronger winds produce longer tails and brighter (less transparent) trail segments; lighter winds appear as short, faint streaks.
- Users can toggle on/off. Also, users can hover over any point on the map briefly displays a small popup with the exact interpolated wind speed and direction at that location.
3. Smoke mode: shows preliminary PM₂.₅ air-quality observations from EPA AirNow monitoring sites. It does not show a smoke-dispersion forecast.
- Point markers use AirNow's reported AQI and the corresponding EPA AQI colors. Raw PM₂.₅ concentration is shown only when AirNow supplies it.
- Users can toggle on/off.
4. NDVI time-series: animates historical NDVI changes (2024).
- Once select , the animation will display on the side bar along with D3 line chart (vegetation index over time).
5. Interactive controls: 
- Layer toggles: users can switch between fire, wind, and smoke modes.
- Search bar: allow users to search for a specific location (like city, county), then automatically zooms to the selected area.
- Color ramp legend: toggling the “Legend” button shows or hides a vertical color bar.
- Popup on Click/Hover: to show the details of each feature.




