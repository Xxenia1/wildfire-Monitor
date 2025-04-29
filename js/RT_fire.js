// real-time fire visualization
let realtimeLayer = null;

export async function addRealtimeLayer(map) {
  try {
    const response = await fetch(
      "https://storage.googleapis.com/storage/v1/b/wildfire-monitor-data/o?prefix=RT_fire_data/&alt=json"
    );
    const json = await response.json();

    const geojsonFiles = json.items
      .filter(item => item.name.endsWith(".geojson"))
      .sort((a, b) => new Date(b.updated) - new Date(a.updated));

    if (geojsonFiles.length === 0) {
      throw new Error("No GeoJSON files found in RT_fire_data.");
    }

    const latestFile = geojsonFiles[0].name;
    const fileUrl = `https://storage.googleapis.com/wildfire-monitor-data/${latestFile}`;

    //console.log(" Latest real-time fire data:", fileUrl);

    const geojsonRes = await fetch(fileUrl);
    const data = await geojsonRes.json();
    //console.log("Sample feature properties:", data.features[0].properties);

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
    //console.log(" Real-time fire layer added");
  } catch (err) {
    //console.error(" Failed to load real-time fire data:", err);
  }
}

export function removeRealtimeLayer(map) {
  if (realtimeLayer) {
    map.removeLayer(realtimeLayer);
    realtimeLayer = null;
    //console.log("Real-time layer removed");
  }
}

