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
    // clean up if needed
    windLayer.stop();
    const canvas = document.getElementById('wind-canvas');
    if (canvas) canvas.remove();
    //map.removeLayer(windLayer);
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

      // Create canvas element for Windy
      const canvas = document.createElement('canvas');
      canvas.id = 'wind-canvas';
      canvas.style.position = 'absolute';
      canvas.style.top = 0;
      canvas.style.left = 0;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      document.getElementById('map').appendChild(canvas);

      // Init Windy.js
      windLayer = new Windy({
        canvas: canvas,
        data: windData,
        map: map,
        velocityScale: 0.01,
        particleCount: 300,
      });

      windLayer.start();
      
      // map view fly to CA once click
      map.flyTo([36.7783, -119.4179], 6);
    })
    
    
    .catch(error => {
      console.error(" Failed to load wind data:", error);
    });
}

// Optional cleanup function (removes wind layer)
export function removeWindLayer(map) {
  if (windLayer) {
    windLayer.stop();
    const canvas = document.getElementById('wind-canvas');
    if (canvas) canvas.remove();
    windLayer = null;
  }
}
