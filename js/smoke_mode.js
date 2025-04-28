// public/js/smoke_mode.js
const smokeLayer = L.layerGroup();
const CA = '-124.48,32.53,-114.13,42.01';
const API_KEY = '2900B648-68DC-4DA9-8912-108C4DC5B87A'; 

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
  this._div = L.DomUtil.create('div', 'info-box');
  this._div.innerHTML = '<h4> Click a Station</h4>';
  //this.update(); //default
  return this._div;
};

infoControl.update = function(obs) {
  if (!obs) {
    this._div.innerHTML = '<h4>Click a station</h4>';
  } else {
    this._div.innerHTML = `
      <h4>Unit Details</h4>
      <b>Location:</b> ${obs.SiteName}/ ${obs.AgencyName}<br/>
      <b>Pollutant:</b> ${obs.Parameter}<br/>
      <b>Time (UTC):</b> ${obs.UTC}<br/>
      <b>AQI:</b> ${obs.AQI} (${obs.getCategoryName})<br/>
    `;
  }
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
  const layerGroup = L.layerGroup().addTo(map);
  map._smokeLayer = layerGroup;
  
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
    `&parameters=PM25`,
    `&BBOX=${CA}`,
    `&dataType=A`,
    `&format=application/json`,
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
        //const catNum = obs.Category;

        const marker = L.circleMarker([lat, lng], {
          radius: getRadius(aqi),      
          fillColor: getAqiColor(aqi), 
          fillOpacity: 0.8,
          //stroke: true,
          color: '#000000',
          weight: 1,
        }).addTo(layerGroup);

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
export function addSmokeLegend(map) {
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
