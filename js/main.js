import { enableWind, disableWind } from './wind_mode.js';
import { enableFire, disableFire } from './Fire_Mode.js';
import { initSmokeMode, removeSmokeMode } from "./smoke_mode.js";
import { initNdviMode, removeNdviMode } from './ndvi_mode.js';


window.map = L.map('map').setView([37.5, -119.5], 7);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap & CARTO', subdomains: 'abcd', maxZoom: 20
}).addTo(map);

// ---- smoke wrappers ----
async function enableSmoke() {
  await initSmokeMode(map, { 
    bbox: [-125, 32, -113, 43.5],
    //maxAgeMin: 60, 
    n: 500, 
    cacheTtl: 600, 
    refreshSec: 0 });
}
function disableSmoke() { removeSmokeMode(map); }

// ---- state & switch ----
let state = { wind:false, fire:false, smoke:false, ndvi:false, current:null };


async function closeMode(mode){
  if (mode === 'wind')  { disableWind(map);  state.wind  = false; }
  if (mode === 'fire')  { disableFire();     state.fire  = false; }
  if (mode === 'smoke') { disableSmoke();    state.smoke = false; }
  if (mode === 'ndvi')  { removeNdviMode(map); state.ndvi = false; } 
}

async function switchMode(mode) {
  if (mode === state.current) { await closeMode(mode); state.current = null; updateBtns(); return; }
  if (state.current) await closeMode(state.current);

  try {
    if (mode === 'wind')  { await enableWind(map);  state.wind  = true; }
    if (mode === 'fire')  { await enableFire();     state.fire  = true; }
    if (mode === 'smoke') { await enableSmoke();    state.smoke = true; }
    if (mode === 'ndvi')  { await initNdviMode(map); state.ndvi = true; }
    state.current = mode;
  } catch(e){ console.error(e); alert('Loading failed, please try again later'); }

  updateBtns();
}

function createModeToolbar() {
  const div = document.createElement('div');
  div.className = 'mode-toolbar';
  div.innerHTML = `
    <button class="mode-btn" data-mode="wind" >Wind</button>
    <button class="mode-btn" data-mode="fire" >Fire</button>
    <button class="mode-btn" data-mode="smoke">Smoke</button>
    <button class="mode-btn" data-mode="ndvi" >NDVI</button>
  `;
  document.body.appendChild(div);
  div.querySelectorAll('.mode-btn').forEach(btn =>
    btn.addEventListener('click', () => switchMode(btn.dataset.mode))
  );
}

function updateBtns(){
  document.querySelectorAll('.mode-btn').forEach(btn => {
    const m = btn.dataset.mode;
    btn.classList.toggle('active', state[m]);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  createModeToolbar();
  document.addEventListener('keydown', e => { if (e.key.toLowerCase()==='w') switchMode('wind'); });
  // initially open fire mode（can switch to wind/smoke）
  switchMode('fire');
});
