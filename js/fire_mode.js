// visualization of the fire mode (real-time & historical)
let realtimeLayer = null;
let historicalLayer = null;

//add real-time fire data layer
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

// remove real-time layer
function removeRealtimeLayer(map) {
  if (realtimeLayer) {
    map.removeLayer(realtimeLayer);
    realtimeLayer = null;
    console.log("Real-time layer removed");
  }
}

// visualize his-fire (2019~2025)
// connects dropdown-year selection with a time slider to filter fire points

let currentYear = null;
let allFeatures = {};  // Cache for each year's data
let currentLayer = null;

// DOM references
const yearSelect = document.getElementById('year-selector');
const timeSlider = document.getElementById('time-slider');
const sliderDateLabel = document.getElementById('slider-date-label');

if (timeSlider && sliderDateLabel) {
  timeSlider.addEventListener('input', () => {
    sliderDateLabel.innerText = `Day ${timeSlider.value}`;
    
  });
} else {
  console.warn(" Time slider or label not found in DOM.");
}

export function initializeFireModeControls(map) {
  document.getElementById('realtime-btn').onclick = () => {
    removeHistoricalLayer(map);
    addRealtimeLayer(map);
  };

  yearSelect.onchange = async (e) => {
    const year = e.target.value;
    currentYear = year;

    if (!allFeatures[year]) {
      const url = `https://storage.googleapis.com/wildfire-monitor-data/fire_data/fire_data_${year}.geojson.geojson`;
      const res = await fetch(url);
      const data = await res.json();
      allFeatures[year] = data.features;
    }

    // Reset slider to selected year range
    timeSlider.min = `${year}-01-01`;
    timeSlider.max = `${year}-12-31`;
    timeSlider.value = `${year}-01-01`;
    sliderDateLabel.innerText = timeSlider.value;

    updateFireLayer(map, timeSlider.value);
  };

  timeSlider.addEventListener('input', () => {
    sliderDateLabel.innerText = timeSlider.value;
    updateFireLayer(map, timeSlider.value);
  });
}

function updateFireLayer(map, selectedDate) {
  if (!currentYear || !allFeatures[currentYear]) return;
  const features = allFeatures[currentYear].filter(f =>
    f.properties.timestamp.startsWith(selectedDate)
  );

  if (currentLayer) map.removeLayer(currentLayer);
  currentLayer = L.geoJSON(features, {
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
      radius: 3,
      fillColor: 'orange',
      color: 'darkred',
      weight: 0.5,
      fillOpacity: 0.7
    }),
    onEachFeature: (feature, layer) => {
      const ts = feature.properties.timestamp;
      const count = feature.properties.count ?? 'N/A';
      layer.bindPopup(`🔥 Fire on ${ts}<br>Count: ${count}`);
    }
  }).addTo(map);
  map.fitBounds(currentLayer.getBounds());
}

function removeHistoricalLayer(map) {
  if (currentLayer) {
    map.removeLayer(currentLayer);
    currentLayer = null;
    console.log("Historical layer removed");
  }
}