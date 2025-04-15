// historical fires visualization
let currentYear = null;
let allFeatures = {};  // Cache for each year's data
let currentLayer = null;

export async function loadHistoricalLayer(map, year) {
  currentYear = year;

  if (!allFeatures[year]) {
    const url = `https://storage.googleapis.com/wildfire-monitor-data/fire_data/fire_data_${year}.geojson.geojson`;
    const res = await fetch(url);
    const data = await res.json();
    allFeatures[year] = data.features;
  }
}

export function updateFireLayer(map, day) {
  if (!currentYear || !allFeatures[currentYear]) return;

  const features = allFeatures[currentYear].filter(f => {
    const date = new Date(f.properties.timestamp);
    const dayOfYear = Math.floor(
      (date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)
    );
    return dayOfYear === day;
  });

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

  if (currentLayer.getLayers().length > 0) {
    map.fitBounds(currentLayer.getBounds());
  } else {
    console.warn("No fire points for selected day.");
  }
}



export function initializeHistoricalControls(map) {
    const yearSelect = document.getElementById('year-selector');
    const timeSlider = document.getElementById('time-slider');
    const sliderDateLabel = document.getElementById('slider-date-label');
  
    if (!yearSelect || !timeSlider || !sliderDateLabel) {
      console.warn("Historical control elements not found in DOM.");
      return;
    }
  
    yearSelect.onchange = async (e) => {
      const year = e.target.value;
      await loadHistoricalLayer(map, year);
  
      // Reset the slider range
      timeSlider.min = 1;
      timeSlider.max = 365;
      timeSlider.value = 1;
      sliderDateLabel.innerText = `Day ${timeSlider.value}`;
  
      updateFireLayer(map, parseInt(timeSlider.value));
    };
  
    timeSlider.addEventListener('input', () => {
      sliderDateLabel.innerText = `Day ${timeSlider.value}`;
      updateFireLayer(map, parseInt(timeSlider.value));
    });
  }
  
