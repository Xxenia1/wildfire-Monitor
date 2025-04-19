// visualization of wind mode
let windLayerGroup;

// Main entry point: fetch today's JSON file and render the wind arrows
export async function renderWindMode(map) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const filename = `${yyyy}${mm}${dd}_wind.json`;

  // Construct the full GCS URL for today's file
  const url = `https://storage.googleapis.com/wildfire-monitor-data/wind/${filename}`;

  try {
    const res = await fetch(url);
    const data = await res.json(); //fetch and parse json
    renderWindLayer(map, data); // Render arrow layer using wind vector data
  } catch (err) {
    console.error('Failed to load wind data:', err);
  }
}

// Render arrow layer given wind data
export function renderWindLayer(map, windData) {
  if (windLayerGroup) {
    map.removeLayer(windLayerGroup); //remove previous layer if exist
  }

  windLayerGroup = L.layerGroup();

  windData.u.forEach((uVal, i) => {
    const vVal = windData.v[i];
    const lat = windData.latitude[i];
    const lon = windData.longitude[i];
    // Compute angle and speed of wind vector
    const speed = Math.sqrt(uVal ** 2 + vVal ** 2);
    const angle = (Math.atan2(vVal, uVal) * 180) / Math.PI;
    // create arrow
    const arrow = L.polylineDecorator(
      L.polyline([[lat, lon], [lat, lon]]),
      {
        patterns: [
          {
            offset: '100%',
            repeat: 0,
            symbol: L.Symbol.arrowHead({
              pixelSize: 8 + speed,
              pathOptions: { color: 'blue', fillOpacity: 0.6, weight: 1 }
            })
          }
        ]
      }
    );

    windLayerGroup.addLayer(arrow);
  });

  windLayerGroup.addTo(map);
}
// Optional cleanup function (removes wind layer)
export function removeWindLayer(map) {
  if (windLayerGroup) {
    map.removeLayer(windLayerGroup);
    windLayerGroup = null;
  }
}
