// visualization of the fire mode
let realtimeLayer = null;
let historicalLayer = null;

export function addRealtimeLayer(map) {
  fetch('Data/fires_merged_tiled_20250331_183204.geojson')
    .then(res => res.json())
    .then(data => {
      realtimeLayer = L.geoJSON(data, {
        pointToLayer: (feature, latlng) => {
          return L.circleMarker(latlng, {
            radius: 4,
            fillColor: "red",
            color: "#800000",
            weight: 0.5,
            fillOpacity: 0.8
          });
        },
        onEachFeature: (feature, layer) => {
          const count = feature.properties.count ?? 'N/A';
          layer.bindPopup(`Fire Count: ${count}`);
        }
      }).addTo(map);
      console.log("Fire data layer added");
    })
    .catch(err => {
      console.error("Failed to load fire GeoJSON:", err);
    });
}

export function removeRealtimeLayer(map) {
  if (realtimeLayer) {
    map.removeLayer(realtimeLayer);
    realtimeLayer = null;
    console.log("Real-time Fire data layer removed");
  }
}

// visualize his-fire (2019~2025)
export function loadHistoricalLayer(map, year) {
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
            layer.bindPopup(`📅 ${year} Fire<br>Count: ${count}`);
          }
        }).addTo(map);
  
        map.fitBounds(historicalLayer.getBounds());
        console.log(`📂 Historical fire data for ${year} loaded`);
      })
      .catch(err => {
        console.error(`Failed to load fire data for ${year}:`, err);
      });
  }
  
  export function removeHistoricalLayer(map) {
    if (historicalLayer) {
      map.removeLayer(historicalLayer);
      historicalLayer = null;
    }
  }
  