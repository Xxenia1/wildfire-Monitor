// import each mode
import { addRealtimeLayer, removeRealtimeLayer } from './RT_fire.js';
import { initializeHistoricalControls, removeHistoricalLayer } from './His_fire.js';
import { renderWindLayer, removeWindLayer } from './wind_mode.js';
import { initSmokeMode, addSmokeLegend  } from './smoke_mode.js';

// Initialize the map
var map = L.map('map').setView([39.8283, -98.5795], 5); // Center at a CA view

// basemap
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// fire mode
// initialize historical fire controls (time slider)
initializeHistoricalControls(map);
addRealtimeLayer(map); // default load

// bind click to real-time fire button
document.getElementById('realtime-btn').addEventListener('click', () =>{
  removeHistoricalLayer(map); //remove historical fire layer
  addRealtimeLayer(map); // return to real-time fire layer
});

// ———— bind Wind button ————
document.getElementById('wind-btn').addEventListener('click', () => {
  removeHistoricalLayer(map);
  removeRealtimeLayer(map);
  removeWindLayer(map);
  renderWindLayer(map); 
});

// ———— bind smoke button ————
document.getElementById('smoke-btn').addEventListener('click', () => {
  removeHistoricalLayer(map);
  removeRealtimeLayer(map);
  removeWindLayer(map);
  // load smoke mode
  initSmokeMode(map);
  addSmokeLegend(map);
  
});

//activate status
