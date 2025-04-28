// visualization of wind mode
let windLayer = null;

// Main entry point: fetch today's JSON file and render the wind arrows
export function renderWindLayer(map) {
  console.log('renderWindLayer triggered');

  if (!map) {
    console.error('map is null or undefined');
    return;
  }
  if (windLayer) {
    map.removeLayer(windLayer);
    windLayer=null;
  }

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const filename = `${yyyy}${mm}${dd}_wind.json`;

  const url = `https://storage.googleapis.com/wildfire-monitor-data/wind/${filename}`;
  console.log(` Fetching wind data from: ${url}`);
  //fetch data
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(windData => {
      console.log('[DEBUG] Wind data loaded:', windData);
      const u10 = windData.u10;
      const v10 = windData.v10;
      const lats = windData.latitude;
      const lons = windData.longitude;

      const windMarkers = [];

      for (let i = 0; i < lats.length; i++) {
        for (let j = 0; j < lons.length; j++) {
          const u = u10[i][j];
          const v = v10[i][j];
          const lat = lats[i];
          const lon = lons[j];

          if (u === null || v === null) continue;
          if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue; 

          const angle = Math.atan2(v, u) * (180 / Math.PI);

          const icon = L.divIcon({
            className: 'wind-icon',
            html: `<div class="wind-arrow" style="transform: rotate(${angle}deg)"></div>`,
          });

          const marker = L.marker([lat, lon], { icon });
          windMarkers.push(marker);
        }
      }

      windLayer = L.layerGroup(windMarkers);
      windLayer.addTo(map);
      console.log(`Rendered ${windMarkers.length} wind markers.`);
    })
    .catch(error => {
      console.error(" Failed to load wind data:", error);
    });
}

// Optional cleanup function (removes wind layer)
export function removeWindLayer(map) {
  if (windLayer) {
    map.removeLayer(windLayer);
    windLayer = null;
  }
}
