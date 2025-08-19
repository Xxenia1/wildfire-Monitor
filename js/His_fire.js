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

// display historical wildfire data on special date
export function updateFireLayer(map, day) {
  if (!currentYear || !allFeatures[currentYear]) return;

  const features = allFeatures[currentYear].filter(f => {
    const date = new Date(f.properties.timestamp);
    // calculate date
    const dayOfYear = Math.floor(
      (date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)
    );
    return dayOfYear === parseInt(day);
  });
    // rendering if there's data
    if (features.length > 0) {
        if (currentLayer){
            map.removeLayer(currentLayer);
        }

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
        layer.bindPopup(`Fire on ${ts}<br>Count: ${count}`);
      }
    }).addTo(map);

    if (currentLayer.getLayers().length>0){
        map.fitBounds(currentLayer.getBounds());
    }
  } else {
    //if there's no data, just give hint, not remove the layer
    //console.warn("No fire points for selected day.");
  }
}

//console.log(" His_fire.js loaded");

function dayOfYearToDate(year, dayOfYear) {
    const date = new Date(year, 0);
    date.setDate(dayOfYear);
    return date;
}

function formatDateLabel(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
  
export function initializeHistoricalControls(map) {
    const yearSelector = document.getElementById('year-selector');
    const timeSlider = document.getElementById('time-slider');
    const sliderLabel = document.getElementById('slider-date-label');
  
    yearSelector.onchange = (e) => {
      const year = e.target.value;
      loadHistoricalLayer(map, year).then(() => {
        timeSlider.value = 1;
        const date = dayOfYearToDate(year,1);
        sliderLabel.innerText = formatDateLabel(date);
        updateFireLayer(map, 1);
      });
    };
  
    timeSlider.addEventListener('input', () => {
      const day = timeSlider.value;
      const date = dayOfYearToDate(currentYear, day);
      sliderLabel.innerText = formatDateLabel(date);
      updateFireLayer(map, day);
    });

    //console.log("his_fire.js is loaded");
  }

//add remove layer function
export function removeHistoricalLayer(map) {
    if (currentLayer) {
      map.removeLayer(currentLayer);
      currentLayer = null;
      //console.log("Historical layer removed");
    }
}
  

  