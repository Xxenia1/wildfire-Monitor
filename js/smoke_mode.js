// public/js/smoke_mode.js
//const smokeLayer = L.layerGroup();
const CA = '-124.48,32.53,-114.13,42.01';
const API_KEY = '2900B648-68DC-4DA9-8912-108C4DC5B87A'; 
let smokeLayerGroup;


//AQI color mappig by category
function getAqiColor(aqi) {
  if (aqi <= 50)   return '#00e400';   // Good
  if (aqi <= 100)  return '#ffff00';   // Moderate
  if (aqi <= 150)  return '#ff7e00';   // Unhealthy for Sensitive Groups
  if (aqi <= 200)  return '#ff0000';   // Unhealthy
  if (aqi <= 300)  return '#8f3f97';   // Very Unhealthy
                   return '#7e0023';   // Hazardous
}
//marker radius
function getRadius(aqi) {
  return 10 + Math.min(aqi / 25, 6);
}
// AQI category name helper
function getCategoryName(catNum) { 
  switch(catNum) {
    case 1: return 'Good';
    case 2: return 'Moderate';
    case 3: return 'Unhealthy for Sensitive';
    case 4: return 'Unhealthy';
    case 5: return 'Very Unhealthy';
    case 6: return 'Hazardous';
    default: return 'Unknown';
  }
}

// info control fixed at top-left corner
const infoControl = L.control({position:'topleft'});

infoControl.onAdd = function(map) {
  this._div = L.DomUtil.create('div', 'info-box' );
  this._div.style.zIndex = 10000;
  this._div.style.display = 'none';
  return this._div;
};

infoControl.update = function(obs) {
  if (!obs) {
    this._div.innerHTML = '';
    this._div.style.display = 'none';   
    return;
  } 

    this._div.style.display = 'block';         
    this._div.classList.remove('expanded');
  
    //set background color
    const bg = getAqiColor(obs.AQI);
    this._div.style.background = bg;
    
    // text and label
    let recommendation = '';
    switch (obs.Category) {
      case 1: recommendation = 'Good time to go outdoors'; break;
      case 2: recommendation = 'Unusually sensitive people consider reducing outdoor activity; go inside to cleaner air if you have symptoms.'; break;
      case 3: recommendation = 'Sensitive groups should take precaution by reducing outdoor activity; go inside to cleaner air if you have symptoms.'; break;
      case 4: recommendation = 'Everyone should take precaution by reducing outdoor activity; go inside to cleaner air if you have symptoms.'; break;
      case 5: recommendation = 'Stay indoors.'; break;
      case 6: recommendation = 'Stay indoors.'; break;
      default: recommendation = 'Air quality advisory';
    }

    // build content
    const name = obs.SiteName || obs.AgencyName || 'Unknown';
    const aqi = obs.AQI || 0;
    const cat   = obs.Category || 1;
    const label = getCategoryName(cat);
    const rec = recommendation;

    //build inner html 
    this._div.innerHTML = `
      <div class="info-grid">
      <div class="info-left">
        <div class="name-box">${name}</div>
      </div>
      <div class="info-right">
        <div class="aqi-subtext">PM2.5 AQI</div>
        <div class="aqi-value">${aqi}</div>
        <div class="aqi-label">${label}</div>
      </div>
    </div>
    <div class="rec-box">${rec}</div>
    <div class="info-actions">
      <button id="btn-expand" class="btn-action">Expand</button>
      <button id="btn-close" class="btn-action">Close</button>
    </div>
    <div class="fire-section">
      <div class="fire-box">
        <a href="#" id="link-fires">No Nearby Fires Detected</a>
      </div>
    </div>
    `;

    //bind events
    this._div.querySelector('#btn-close').onclick = () => infoControl.update();
    this._div.querySelector('#btn-expand').onclick = () => {
      console.log('expand clicked');
      this._div.classList.toggle('expanded');
    };
    this._div.querySelector('#link-fires').onclick = e => {e.preventDefault();
      // 三级弹窗逻辑占位
    /*
    showNearbyFiresDialog(obs);
    */
  };
};

//initialize smoke layer
export function initSmokeMode(map) {
  //fly to CA view
  map.flyTo([36.7783, -119.4179], 6, { duration: 1.2 });

  // delete previous map layer if exists
  if (map._smokeLayer) map.removeLayer(map._smokeLayer);

  //add control to map
  infoControl.addTo(map);

  //create new layer group
  smokeLayerGroup = L.layerGroup().addTo(map);
  map._smokeLayer = smokeLayerGroup;
  
  // calculate CA's time
  const nowPac = new Date().toLocaleString('en-US', {
    timeZone:'America/Los_Angeles'
  });
  const now    = new Date(nowPac);
  const YYYY   = now.getFullYear();
  const MM     = String(now.getMonth()+1).padStart(2,'0');
  const DD     = String(now.getDate()).padStart(2,'0');
  const hh     = String(now.getHours()).padStart(2,'0');

  const startDate = `${YYYY}-${MM}-${DD}T00`;
  const endDate   = `${YYYY}-${MM}-${DD}T${hh}`;

  // request URL
  const url = [
    'https://www.airnowapi.org/aq/data/',
    `?startDate=${startDate}`,
    `&endDate=${endDate}`,
    `&parameters=PM25`, //pollutants
    `&BBOX=${CA}`,
    `&dataType=A`,
    `&format=application/json`,
    "&verbose=1",
    `&monitorType=0`,
    `&includeRawConcentration=1`,
    `&API_KEY=${API_KEY}`
  ].join('');

  // fetch data, create points on map, and bind event
  fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
    .then(data => {

      console.log('sample smoke date:', data[0]);

      data.forEach(obs => {
        
        const lat = obs.Latitude;
        const lng = obs.Longitude;
        const aqi = obs.AQI;
        const catNum = obs.Category;
        const catLabel = getCategoryName(catNum);
        //console.log('catLabel is', catLabel);

        const marker = L.circleMarker([lat, lng], {
          radius: getRadius(aqi),      
          fillColor: getAqiColor(aqi), 
          fillOpacity: 0.8,
          //stroke: true,
          color: '#000000',
          weight: 0.5,
        }).addTo(smokeLayerGroup);

        // update control
        marker.on('click', () => {
          infoControl.update(obs);
        });
      });
    })
    .catch(err => {
      console.error('Failed to load smoke data:', err);
      alert('Error loading smoke layer. See console.');
    });
}


// add Legend
let smokeLegendControl = null;
export function addSmokeLegend(map) {
  //remove the previous one if exists
  if (smokeLegendControl) {
    map.removeControl(smokeLegendControl);
  }
  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'smoke-legend');
    div.style.background = 'white';
    div.style.padding = '6px';
    div.style.boxShadow = '0 0 6px rgba(0,0,0,0.3)';
    div.innerHTML = '<b>AQI Legend</b><br>' +
      [ [0,50,'Good'], [51,100,'Moderate'], [101,150,'Unhealthy for Sensitive'],
        [151,200,'Unhealthy'], [201,300,'Very Unhealthy'], [301,500,'Hazardous'] ]
      .map(([min,max,label]) =>
        `<i style="background:${getAqiColor(min)};width:12px;height:12px;display:inline-block;margin-right:6px;"></i>`+
        `${min}-${max} ${label}`
      ).join('<br>');
    return div;
  };
  legend.addTo(map);
}

// remove layer
export function removeSmokeLayer(map) {
  if (smokeLayerGroup) {
    map.removeLayer(smokeLayerGroup);
    smokeLayerGroup = null;
  }

  if (smokeLegendControl) {
    map.removeControl(smokeLegendControl);
    smokeLegendControl = null;
  }

  if (infoControl) {
    map.removeControl(infoControl);
  }
}
