// test for fire mode
// Fire Mode Visualization (Real-time + Historical)

let realtimeLayer = null;
let historicalLayer = null;

// Add Real-time Fire Data Layer
export async function addRealtimeLayer(map) {
  try{
    // get all files in RT_fire_data folder
    const response = await fetch(
      "https://storage.googleapis.com/storage/v1/b/wildfire-monitor-data/o?prefix=RT_fire_data/&alt=json"
    );
    const json = await response.json();

    //filter geojson files only
    const geojsonFiles = json.items
      .filter(item => item.name.endsWith(".geojson"))
      .sort((a, b) => new Date(b.updated) - new Date(a.updated)); // newest first

    if (geojsonFiles.length === 0) {
        throw new Error("No GeoJSON files found in RT_fire_data.");
    }

    const latestFile = geojsonFiles[0].name;
    const fileUrl = `https://storage.googleapis.com/wildfire-monitor-data/${latestFile}`;

    console.log(" Latest real-time fire data:", fileUrl);

    // Step 3: Fetch the latest geojson and visualize
    const geojsonRes = await fetch(fileUrl);
    const data = await geojsonRes.json();
    // check attribute
    console.log("Sample feature properties:", data.features[0].properties);

    realtimeLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
        radius: 4,
        fillColor: 'red',
        color: '#800000',
        weight: 0.5,
        fillOpacity: 0.8
      }),
      onEachFeature: (feature, layer) => {
        const count = feature.properties.count ?? 'N/A';
        layer.bindPopup(` Real-time Fire<br>Count: ${count}`);
      }
    }).addTo(map);

    map.fitBounds(realtimeLayer.getBounds());
    console.log(" Real-time fire layer added");

  } catch (err) {
    console.error(" Failed to load real-time fire data:", err);
  }
  
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

