// ----------------- Imports -----------------
import { addRealtimeLayer, removeRealtimeLayer } from './RT_fire.js';
import { initializeHistoricalControls, removeHistoricalLayer } from './His_fire.js';
import { renderWindLayer, removeWindLayer } from './wind_mode.js';
import { initSmokeMode, addSmokeLegend } from './smoke_mode.js';
import { initNdviMode } from './ndvi_mode.js';

// ----------------- Wait until DOM is ready -----------------
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize map
  const map = L.map('map').setView([39.8283, -98.5795], 5);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // 2. Fire mode default load
  initializeHistoricalControls(map);
  addRealtimeLayer(map);
  document.getElementById('fire-control-panel').style.display = 'flex';

  // 3. Helper to hide all panels
  function hideAllPanels() {
    document.getElementById('fire-control-panel').style.display = 'none';
    document.getElementById('sidebar-content').style.display = 'none';
    document.getElementById('sidebar-content').innerHTML = '';
    removeRealtimeLayer(map);
    removeHistoricalLayer(map);
    removeWindLayer(map);
    // optionally: remove smoke or others
  }

  // 4. Dropdown toggle logic
  const modeMenu = document.getElementById('mode-menu');
  const modeDropdownContainer = document.getElementById('mode-dropdown-container');

  document.getElementById('main-mode-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    modeMenu.style.display = (modeMenu.style.display === 'block') ? 'none' : 'block';
  });

  window.addEventListener('click', (e) => {
    if (modeDropdownContainer && !modeDropdownContainer.contains(e.target)) {
      modeMenu.style.display = 'none';
    }
  });

  // 5. Fire mode
  document.getElementById('fire-btn').addEventListener('click', () => {
    hideAllPanels();
    document.getElementById('fire-control-panel').style.display = 'flex';
    initializeHistoricalControls(map);
    addRealtimeLayer(map);
  });


  // 6. Wind mode
  document.getElementById('wind-btn').addEventListener('click', () => {
    hideAllPanels();
    renderWindLayer(map);
  });

  // 7. Smoke mode
  document.getElementById('smoke-btn').addEventListener('click', () => {
    hideAllPanels();
    initSmokeMode(map);
    addSmokeLegend(map);
  });

  // 8. NDVI mode
  document.getElementById('ndvi-btn').addEventListener('click', () => {
    hideAllPanels();
    initNdviMode();
  });
});
