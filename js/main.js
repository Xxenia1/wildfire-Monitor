// import each mode
import { addRealtimeLayer, removeRealtimeLayer } from './RT_fire.js';
import { initializeHistoricalControls, removeHistoricalLayer } from './His_fire.js';
import { renderWindLayer, removeWindLayer } from './wind_mode.js';
import { initSmokeMode, addSmokeLegend  } from './smoke_mode.js';
import { initNdviMode } from './ndvi_mode.js';

// Initialize the map
var map = L.map('map').setView([39.8283, -98.5795], 5); // Center at a CA view

// basemap
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// ———— default load (fire mode) ————
initializeHistoricalControls(map);
addRealtimeLayer(map);
document.getElementById('fire-control-panel').style.display = 'block';

// helper: hide all control UIs and layers
function hideAllPanels() {
  document.getElementById('fire-control-panel').style.display = 'none';
  document.getElementById('sidebar-content').style.display = 'none';
  document.getElementById('sidebar-content').innerHTML = '';

  removeRealtimeLayer(map);
  removeHistoricalLayer(map);
  removeWindLayer(map);
  // (optional: removeSmokeLayer if you have it)
}

// ———— Fire Mode ————
document.getElementById('fire-btn').addEventListener('click', () => {
  hideAllPanels();
  document.getElementById('fire-control-panel').style.display = 'block';
  initializeHistoricalControls(map);
  addRealtimeLayer(map);
});

// bind click to real-time fire button
document.getElementById('realtime-btn').addEventListener('click', () => {
  removeHistoricalLayer(map);
  addRealtimeLayer(map);
});

// ———— Wind Mode ————
document.getElementById('wind-btn').addEventListener('click', () => {
  hideAllPanels();
  renderWindLayer(map);
});

// ———— Smoke Mode ————
document.getElementById('smoke-btn').addEventListener('click', () => {
  hideAllPanels();
  initSmokeMode(map);
  addSmokeLegend(map);
});

// ———— NDVI Mode ————
document.getElementById('ndvi-btn').addEventListener('click', () => {
  hideAllPanels();
  initNdviMode();
});

//  Show/hide dropdown menu
const modeMenu = document.getElementById('mode-menu');
document.getElementById('main-mode-btn').addEventListener('click', (e) => {
  e.stopPropagation(); // prevent window click from instantly closing
  modeMenu.style.display = (modeMenu.style.display === 'block') ? 'none' : 'block';
});

//  Click outside to close dropdown
window.addEventListener('click', (e) => {
  const container = document.getElementById('mode-dropdown-container');
  if (container && !container.contains(e.target)) {
    modeMenu.style.display = 'none';
  }
});
