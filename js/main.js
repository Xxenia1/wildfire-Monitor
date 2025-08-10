// Initialize the Leaflet map and add layers for wind, fire, smoke, and NDVI modes. Allow toggling between modes.
import { enableWind, disableWind } from './wind_mode.js'; // Import the wind mode functions
import { enableFire, disableFire } from './Fire_Mode.js'; // Import the fire mode functions
import { initSmokeMode, removeSmokeMode, refreshSmokeMode } from "./smoke_mode.js"; // Import the smoke mode functions

// 1. Initialize the map: set center (lat/lng) and zoom level
window.map = L.map('map').setView([37.5, -119.5], 6);
// California: [latitude, longitude], zoom level 6-7 is good for statewide view

// 2. Add the OpenStreetMap basemap tiles
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
	subdomains: 'abcd',
	maxZoom: 20
}).addTo(map);

window.smoke = {};
smoke.layer = await initSmokeMode(map, {
  // 可调参数：
  // bbox: [-125, 32, -113, 43.5], // 默认加州
  maxAgeMin: 60,  // 过去 60 分钟
  n: 1000,
  cacheTtl: 30,
  refreshSec: 60  // 每 60s 自动刷新；不需要自动刷新就删掉这一行
});

// Mode status (Only one is allowed to be opened at a time)
let state = {
  wind: false,
  fire: false,
  smoke: false,
  ndvi: false,
};
// ---- Mode Switching Logic ----
async function switchMode(mode) {
 if (mode === state.current) {
    // Click the same button again = close the mode
    await closeMode(mode);
    state.current = null;
    return;
  } 
  // Close the currently active mode first
  if (state.current) await closeMode(state.current);
  
  // 先把与目标互斥的模式关掉（这里演示全关）
  if (mode !== 'wind' && state.wind) { disableWind(map); state.wind = false; }
  if (mode !== 'fire' && state.fire) { disableFire(map); state.fire = false; }
  if (mode !== 'smoke' && state.smoke) { disableSmoke(); state.smoke = false; }
  if (mode !== 'ndvi' && state.ndvi) { disableNDVI(); state.ndvi = false; }

  // 再开启目标模式（toggle）
  try {
    if (mode === 'wind') {
      if (!state.wind) { await enableWind(map); state.wind = true; }
      else { disableWind(map); state.wind = false; }
    } else if (mode === 'fire') {
      if (!state.fire) { await enableFire(); state.fire = true; }
      else { disableFire(); state.fire = false; }
    } else if (mode === 'smoke') {
      if (!state.smoke) { await enableSmoke(); state.smoke = true; }
      else { disableSmoke(); state.smoke = false; }
    } else if (mode === 'ndvi') {
      if (!state.ndvi) { await enableNDVI(); state.ndvi = true; }
      else { disableNDVI(); state.ndvi = false; }
    }
  } catch (e) {
    console.error(e);
    alert('加载失败，请稍后重试');
  }

  // 按钮激活态
  document.querySelectorAll('.mode-btn').forEach(btn => {
    const m = btn.dataset.mode;
    btn.classList.toggle('active', !!state[m]);
  });
}
// ---- 动态创建“模式菜单” ----
function createModeToolbar() {
  const div = document.createElement('div');
  div.className = 'mode-toolbar';
  div.innerHTML = `
    <button class="mode-btn" data-mode="wind"  title="Wind (W)">Wind</button>
    <button class="mode-btn" data-mode="fire"  title="Fire">Fire</button>
    <button class="mode-btn" data-mode="smoke" title="Smoke">Smoke</button>
    <button class="mode-btn" data-mode="ndvi"  title="NDVI">NDVI</button>
  `;
  document.body.appendChild(div);

  div.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
  });
}

// ---- 启动 ----
window.addEventListener('DOMContentLoaded', () => {
  createModeToolbar();

  // 先给你个快捷键：W 开/关 wind，便于测试
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'w') switchMode('wind');
  });

  // 想默认进某个模式（方便你测试），可以取消下一行注释
  // switchMode('wind');
});



