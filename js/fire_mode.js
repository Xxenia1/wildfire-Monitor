// visualization of the fire mode
let fireLayer = null;

export function addFireLayer(map) {
  fetch('Data/fires_merged_tiled_20250331_183204.geojson')
    .then(res => res.json())
    .then(data => {
      fireLayer = L.geoJSON(data, {
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

export function removeFireLayer(map) {
  if (fireLayer) {
    map.removeLayer(fireLayer);
    fireLayer = null;
    console.log("🧹 Fire data layer removed");
  }
}
