// import each mode
import { initializeFireModeControls, addRealtimeLayer } from './fire_mode.js';

// Initialize the map
var map = L.map('map').setView([39.8283, -98.5795], 5); // Center at a CA view

// Add OpenStreetMap as the basemap
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

// initialize fire mode controls(real-time and historical)
initializeFireModeControls(map);

// default loading fire mode
addRealtimeLayer(map);