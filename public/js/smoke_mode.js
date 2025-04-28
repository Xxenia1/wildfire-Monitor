// public/js/smoke_mode.js
const smokeLayer = L.layerGroup();
const CA = '-124.48,32.53,-114.13,42.01';
const API_KEY = '2900B648-68DC-4DA9-8912-108C4DC5B87A'; 

//AQI color mappig
function getAqiColor(aqi) {
  if (aqi <= 50)   return '#00e400';   // Good
  if (aqi <= 100)  return '#ffff00';   // Moderate
  if (aqi <= 150)  return '#ff7e00';   // Unhealthy for Sensitive Groups
  if (aqi <= 200)  return '#ff0000';   // Unhealthy
  if (aqi <= 300)  return '#8f3f97';   // Very Unhealthy
                   return '#7e0023';   // Hazardous
}
//size of markers
function getRadius(aqi) {
  return 10 + Math.min(aqi / 25, 6);
}
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

// popup content
function showSmokeDetails(map, obs, latlng) {
  const html = `
    <div style="max-width:300px; font-family:Arial,sans-serif;">
      <h3 style="margin:0 0 .5em;">Unit Details</h3>
      <p style="margin:0 .5em .3em;"><strong>Location:</strong> ${obs.SiteName}</p>
      <p style="margin:0 .5em .3em;"><strong>Type:</strong> ${obs.AgencyName || 'N/A'}</p>
      <p style="margin:0 .5em .3em;"><strong>Pollutant:</strong> ${obs.Parameter}</p>
      <p style="margin:0 .5em .3em;"><strong>Time (UTC):</strong> ${obs.UTC}</p>
      <p style="margin:0 .5em .3em;"><strong>AQI:</strong> ${obs.AQI} (${getCategoryName(obs.Category)})</p>
      <p style="margin:0 .5em .8em;"><strong>Raw Conc.:</strong> ${obs.RawConcentration}</p>
      <button id="smoke-detail-close" style="display:block;margin:0 auto;padding:.5em 1em;">Close</button>
    </div>
  `;
  const popup = L.popup({ maxWidth: 320 })
    .setLatLng(latlng)
    .setContent(html)
    .openOn(map);

  document.getElementById('smoke-detail-close')
    .addEventListener('click', () => map.closePopup(popup));
}

//initialize smoke layer
export function initSmokeMode(map) {
  //fly to CA
  map.flyTo([36.7783, -119.4179], 6, { duration: 1.2 });
  // delete previous map layer if exists
  if (map._smokeLayer) map.removeLayer(map._smokeLayer);

  const layer = L.layerGroup().addTo(map);
  map._smokeLayer = layer;

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

  fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
    .then(data => {
      data.forEach(obs => {
        const lat = obs.Latitude;
        const lng = obs.Longitude;
        const aqi = obs.AQI;
        const cat = obs.Category;
        const marker = L.circleMarker([lat, lng], {
          radius: getRadius(aqi),      //size
          
          fillColor: getAqiColor(aqi), //
          fillOpacity: 0.8,
          stroke: true,
          color: '#000000',
          weight: 1,
        }).addTo(map);

        const summary = `
          <div style="font-family:Arial,sans-serif;">
            <strong>${obs.SiteName}</strong><br>
            Time: ${obs.UTC}<br>
            Pollutant: ${obs.Parameter}<br>
            AQI: <span style="font-weight:bold;">${aqi}</span> (${getCategoryName(cat)})<br>
            <a href="#" class="view-smoke-detail">View Details</a>
          </div>
        `;
        marker.bindPopup(summary);

        marker.on('popupopen', () => {
          const link = document.querySelector('.view-smoke-detail');
          if (link) {
            link.addEventListener('click', e => {
              e.preventDefault();
              showSmokeDetails(map, obs, marker.getLatLng());
            });
          }
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
