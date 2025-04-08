// test for fire mode
// Fire Mode Visualization (Real-time + Historical)

let realtimeLayer = null;
let historicalLayer = null;

// Add Real-time Fire Data Layer
export function addRealtimeLayer(map) {
  fetch('https://storage.googleapis.com/wildfire-monitor-data/RT_fire_data/fires_tile_4_20250408.geojson.geojson')
    .then(res => res.json())
    .then(data => {
      const realtimeLayer = L.geoJSON(data, {
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
          radius: 4,
          fillColor: 'red',
          color: '#800000',
          weight: 0.5,
          fillOpacity: 0.8
        }),
        onEachFeature: (feature, layer) => {
          const count = feature.properties.count ?? 'N/A';
          layer.bindPopup(`🔥 Real-time Fire<br>Count: ${count}`);
        }
      }).addTo(map);

      map.fitBounds(realtimeLayer.getBounds());
      console.log("✅ Real-time fire data loaded");
    })
    .catch(err => {
      console.error(" Failed to load real-time fire data:", err);
    });
}


// Remove Real-time Layer
function removeRealtimeLayer(map) {
  if (realtimeLayer) {
    map.removeLayer(realtimeLayer);
    realtimeLayer = null;
    console.log("Real-time layer removed");
  }
}

// Add Historical Fire Data Layer
function loadHistoricalLayer(map, year) {
  removeRealtimeLayer(map);
  if (historicalLayer) {
    map.removeLayer(historicalLayer);
  }

  const url = `https://storage.googleapis.com/wildfire-monitor-data/fire_data/fire_data_${year}.geojson`;
  fetch(url)
    .then(res => res.json())
    .then(data => {
      historicalLayer = L.geoJSON(data, {
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
          radius: 3,
          fillColor: 'orange',
          color: '#cc5500',
          weight: 0.5,
          fillOpacity: 0.7
        }),
        onEachFeature: (feature, layer) => {
          const count = feature.properties.count ?? 'N/A';
          layer.bindPopup(`📅 ${year} Historical Fire<br>Count: ${count}`);
        }
      }).addTo(map);
      map.fitBounds(historicalLayer.getBounds());
      console.log(`Historical fire data for ${year} loaded`);
    })
    .catch(err => {
      console.error(`Failed to load historical fire data for ${year}:`, err);
    });
}

// Remove Historical Layer
function removeHistoricalLayer(map) {
  if (historicalLayer) {
    map.removeLayer(historicalLayer);
    historicalLayer = null;
    console.log("Historical layer removed");
  }
}

// UI Interaction
export function initializeFireModeControls(map) {
  document.getElementById('realtime-btn').onclick = () => {
    addRealtimeLayer(map);
  };

  document.getElementById('year-selector').onchange = (e) => {
    const year = e.target.value;
    loadHistoricalLayer(map, year);
  };
}

// Example HTML for your controls:
/*
<button id="realtime-btn">🔥 Real-time Fire</button>
<select id="year-selector">
  <option value="">Select Year</option>
  <option value="2019">2019</option>
  <option value="2020">2020</option>
  <option value="2021">2021</option>
  <option value="2022">2022</option>
  <option value="2023">2023</option>
  <option value="2024">2024</option>
  <option value="2025">2025</option>
</select>
*/
