// visualization of smoke mode
// Initialize the map (DELETE once DOWN!!!)
var map = L.map('map').setView([39.8283, -98.5795], 5); // Center at a CA view

// basemap
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

let smokeLayerGroup = L.layerGroup().addTo(map);

function loadSmokeLayer(map) {
  smokeLayerGroup.clearLayers();

  // California bounding box
  const nwlat = 42.0;
  const nwlng = -125.0;
  const selat = 32.0;
  const selng = -114.0;

  const url = `https://api.purpleair.com/v1/sensors?fields=name,latitude,longitude,pm2.5,humidity,temperature,altitude&nwlng=${nwlng}&nwlat=${nwlat}&selng=${selng}&selat=${selat}`;

  fetch(url, {
    headers: {
      "X-API-Key": CONFIG.PURPLEAIR_API_KEY
    }
  })
    .then(res => res.json())
    .then(json => {
      const { data, fields } = json;
      const index = fields.reduce((obj, k, i) => {
        obj[k] = i;
        return obj;
      }, {});

      console.log(`Total sensors loaded: ${data.length}`); // Show count in console

      data.forEach(sensor => {
        const lat = sensor[index.latitude];
        const lon = sensor[index.longitude];
        const pm = sensor[index["pm2.5"]];
        const name = sensor[index.name];
        const temp = sensor[index.temperature];
        const humidity = sensor[index.humidity];

        let color = "green";
        if (pm > 35) color = "orange";
        if (pm > 55) color = "red";

        const marker = L.circleMarker([lat, lon], {
          radius: 6,
          fillColor: color,
          color: "#000",
          weight: 1,
          fillOpacity: 0.7
        });

        marker.bindPopup(`
          <b>${name}</b><br>
          PM2.5: ${pm} µg/m³<br>
          Temp: ${temp} °C<br>
          RH: ${humidity}%
        `);

        marker.addTo(smokeLayerGroup);
      });
    })
    .catch(err => {
      console.error("PurpleAir API fetch error:", err);
    });
}

// Initial load
loadSmokeLayer(map);

// Auto-refresh every 2 hours
setInterval(() => {
  console.log("Refreshing smoke data...");
  loadSmokeLayer(map);
}, 2 * 60 * 60 * 1000); // 2 hours

// Add Legend
const legend = L.control({ position: "bottomright" });
legend.onAdd = function (map) {
  const div = L.DomUtil.create("div", "info legend");
  div.innerHTML = `
    <h4>PM2.5 Levels</h4>
    <i style="background: green"></i> Good (< 35)<br>
    <i style="background: orange"></i> Moderate (35–55)<br>
    <i style="background: red"></i> Unhealthy (> 55)<br>
  `;
  return div;
};
legend.addTo(map);