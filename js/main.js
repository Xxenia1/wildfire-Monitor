//import { initFirePointsLayer } from './Fire_Mode.js';

// 1. Initialize the map: set center (lat/lng) and zoom level
const map = L.map('map').setView([37.5, -119.5], 6);
// California: [latitude, longitude], zoom level 6-7 is good for statewide view

// 2. Add the OpenStreetMap basemap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 3. Load fire points layer (this fetches and visualizes the points)
//initFirePointsLayer(map);

