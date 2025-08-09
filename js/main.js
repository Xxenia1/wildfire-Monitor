//import { initFirePointsLayer } from './Fire_Mode.js';
import { enableWind, disableWind } from './wind_mode.js';

// 1. Initialize the map: set center (lat/lng) and zoom level
const map = L.map('map').setView([37.5, -119.5], 6);
// California: [latitude, longitude], zoom level 6-7 is good for statewide view

// 2. Add the OpenStreetMap basemap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
// Mode status
let state = {
  wind: false,
  fire: false,
  smoke: false,
  ndvi: false,
};
async function switchMode(mode) {
  // 先把与目标互斥的模式关掉（这里演示全关）
  if (mode !== 'wind' && state.wind) { disableWind(map); state.wind = false; }
  if (mode !== 'fire' && state.fire) { disableFire(); state.fire = false; }
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



