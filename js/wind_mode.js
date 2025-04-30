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
      const lats = windData.latitude;
      const lons = windData.longitude;
    
      const markers = [];
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          markers.push(
            L.circleMarker([lats[i][j], lons[i][j]], { radius: 4 })
          );
        }
      }
      L.layerGroup(markers).addTo(map);
      console.log('画了 100 个测试点');
      return;
    })
    
    // .then(windData => {
    //   console.log('[DEBUG] Wind data loaded:', windData);
    //   const u10 = windData.u10;
    //   const v10 = windData.v10;
    //   const lats = windData.latitude; // [1005][596]
    //   const lons = windData.longitude; // [1005][596]

    //   //调试打印看是一维还是二维
    //   console.log(
    //     'lats shape:', lats.length,
    //     Array.isArray(lats[0]) ? `×${lats[0].length}` : '(1D)'
    //   );
    //   console.log(
    //     'lons shape:', lons.length,
    //     Array.isArray(lons[0]) ? `×${lons[0].length}` : '(1D)'
    //   );
    //   console.log('sample lats[0..3]:', lats.slice(0,4));
    //   console.log('sample lons[0..3]:', lons.slice(0,4));

    //   // u/v 的维度
    //   console.log(
    //     'u10 shape:',  u10.length, Array.isArray(u10[0]) ? u10[0].length : '(1D)'
    //   );
    //   console.log(
    //     'v10 shape:',  v10.length, Array.isArray(v10[0]) ? v10[0].length : '(1D)'
    //   );
      

    //   // ————————————————————————————
    //   const windMarkers = [];
      
    //   for (let i = 0; i < u10.length; i++) {     //1005 row
    //     for (let j = 0; j < u10[i].length; j++) {  //596 column
    //       const u = u10[i][j];
    //       const v = v10[i][j];
    //       const lat = lats[i];
    //       const lon = lons[j];

    //       // filter null/NaN/undefined
    //       if (
    //         !Number.isFinite(lat) ||
    //         !Number.isFinite(lon) ||
    //         !Number.isFinite(u)   ||
    //         !Number.isFinite(v)
    //       ) continue;

    //       if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue; 
    //       //compute angle
    //       const angle = Math.atan2(v, u) * (180 / Math.PI);

    //       const icon = L.divIcon({
    //         className: 'wind-icon',
    //         iconSize:   [20, 20],
    //         iconAnchor: [10, 10],
    //         html: `<div class="wind-arrow" style="transform: rotate(${angle}deg)"></div>`,
    //       });

    //       const marker = L.marker([lat, lon], { icon });
    //       windMarkers.push(marker);
    //     }
    //   }
    //   // put marker on layer
    //   windLayer = L.layerGroup(windMarkers);
    //   windLayer.addTo(map);
    //   console.log(`Rendered ${windMarkers.length} wind markers.`);
    // })
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
