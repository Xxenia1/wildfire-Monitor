# California Wildfire Monitoring Platform
## Brief Introduction:
    The wildfire monitoring platform aims to provide an interactive, real-time monitoring platform for tracking wildfires, wind speed, and smoke dispersion in California. By leveraging Google Earth Engine (GEE) as backend with a series of functions extracting, preparing, loading, and manipulating all satellite data. At the front end of this project, it mainly utilizes leaflet.js and D3.js implement all visualizations.

### Audience:
1. Researchers who study wildfire behavior and trends.
2. Emergency officials: like firefighters and their management team can use this real-time fire tracking for response planning.
3. Individuals who concerned about real-time wildfire conditions.

### Region/Study Area: California
## Data: 
    All satellite data can be used directly in GEE, because it combines a multi-petabyte catalog of satellite imagery: 
    | Column 1 | Column 2 | Column 3 |
    |----------|----------|----------|
    | Data 1   | Data 2   | Data 3   |

Data	Source/	Code examples	Usage
GOES ABI (Advanced Baseline Imager)	GOES-16 MCMIPC Series ABI Level 2 Cloud and Moisture Imagery CONUS	 	displaying historical wildfire data
VIIRS	VJ114IMGTDL_NRT Daily Raster: VIIRS (NOAA-20) Band 375m Active Fire	 	Used for detecting real-time wildfire data, and it updates per day. (2023~present)
NDVI time series	Sentinel-2		Used for displaying NDVI time series. (2013~present)
Table 1 datasets in GEE
(All code examples show in the table are searched directly from Earth Engine Data Catalog)
•	Wind and smoke: using NOAA Operational Model Archive and Distribution System (NOMADS) API to fetch hourly High_Resolution Rapid Refresh (HRRR) data.
Deliverable:
    The final deliverable is an interactive web-based wildfire monitoring system that displays real-time wildfire activities, wind patterns, and smoke dispersion with the ability to switch between different data layers. It includes several modes:

1. Fire mode: display real-time wildfire locations using VIIRS data, which updates ever 12 hours.
•	Active fire hotspots: display as fire icons. And users can click each fire point to learn fire size, detection time, source, etc.
•	Display the affected area of ongoing/historical fires.
•	Time slider tool: updates historical fire (since 2019) data dynamically. 
2. Wind mode: overlays animated wind speed and direction from NOAA HRRR, which updates every hour. 
•	Animated wind particles flow in the direction of wind movement.
•	The speed of particles depends on the wind speed.
•	Opacity and color intensity represent wind strength.
•	Users can toggle on/off.
3. Smoke mode: shows smoke dispersion from NOAA HRRR Smoke, which updates every hour.
•	A semi-transparent gradient overlay shows smoke concentration.
•	Darker areas indicate higher smoke density.
•	Users can toggle on/off.
4. NDVI time-series: animates NDVI changes over time. (2024~present)
•	Once select , the animation will display on the side bar along with D3 line chart (vegetation index over time).
5. Interactive controls: 
•	Layer toggles: users can switch between fire, wind, and smoke modes.
•	Search bar: allow users to search for a specific location (like city, county), then automatically zooms to the selected area.
•	Time slider: allow users to view historical fire data dynamically.
Conceptual Knowledge & Technical Skills:
It will draw from the following GIS&T BoK knowledges areas and specific courses skills:
•	Cartography and Visualization: 
o	Web Mapping: This platform will include a multi-layered interactive map that dynamically represents real-time wildfire hotspots, wind direction, and smoke dispersion using leaflet.js. (GEOG 572, GEOG 575)
o	User Interface and User Experience (UI/UX) Design: It contains several layer toggles (fire, wind, smoke) and animated overlays to enhance user experience, offer signal changes in data and interaction responses. All animation parts will be implemented by D3.js, while the interactive map and controls implemented by leaflet.js. (GEOG575)
•	Data Capture: 
o	Processing Remotely Sensed Data: It will utilize GEE to process, analyze, and visualize all satellite imagery. For example, extracting wildfire hotspots from GOES-16, computing NDVI change over time, etc. (GEOG 379, GEOG 578) 
•	Programming and Development: 
o	GIS APIs: It utilizes NOMADS API for data retrieval like wind direction, wind speed, and smoke dispersion (GEOG 576). And using leaflet API to deliver light-weight interactive web maps. (GEOG 575)
Architectural/Software Diagram:
Design Tool	Leaflet.js: design basemap and custom interface.
D3.js: implement all charts and animations
Python (Matplotlib/R) to animate NDVI change map and graph.
Data Mgmt. & Analysis Tools	GEE for data retrieval and data processing, NOAA HRRR for wind and smoke data.
Software Development	JavaScript (Leaflet.js) for visualization,
Vscode as development environment.
Database	GEE as backend for processing data.
NOMADS API to fetch wind &smoke data.
Hosting Environment	GitHub for hosting frontend deployment, while GEE for backend computations.
Data Sources	VIIRS, GOES-ABI, Landsat-8, NOAA HRRR


