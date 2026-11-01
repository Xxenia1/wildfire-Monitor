// visualization of wind mode（leaflet-velocity）
import { setDataStatus, setDataError } from "./data_status.js";

let windLayer = null;
let windCtl = null;
let refreshTimer = null;

async function fetchVelocityJson() {
  // Add a timestamp to prevent caching
  const url = `./Data/Wind/wind_ca_velocity.json?t=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch wind json failed: ${res.status}`);
    const grid = await res.json();
    if (!Array.isArray(grid) || !grid[0]?.header?.refTime) throw new Error("Invalid wind snapshot");
    setDataStatus("Wind", grid[0].header.refTime, 36 * 60 * 60 * 1000);
    return grid;
  } catch (error) {
    setDataError("Wind");
    throw error;
  }
}

async function refreshWind() {
  const data = await fetchVelocityJson();
  if (windLayer && typeof windLayer.setData === "function") windLayer.setData(data);
  else if (windLayer?._map) {
    const map = windLayer._map;
    map.removeLayer(windLayer);
    windLayer = L.velocityLayer({ data, maxVelocity: 25, velocityScale: 0.015, particleMultiplier: 0.008, opacity: 0.9, lineWidth: 1 }).addTo(map);
  }
}

//Use Leaflet Control to make a small toolbar that only appears in wind mode
function makeControl(map) {
  // tool only shows in wind mode
  const C = L.Control.extend({
    onAdd: () => {
      const div = L.DomUtil.create('div', 'wind-toolbar');
      div.innerHTML = `
        <button class="wind-btn" id="wind-refresh" title="Refresh">↻</button>
        <button class="wind-btn" id="wind-close"   title="Close">✕</button>
      `;
      // Prevent text selection/bubbling when dragging the map
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);

      div.querySelector('#wind-refresh').onclick = async () => {
        try {
          await refreshWind();
        } catch (e) { console.error(e); alert('刷新失败'); }
      };

      div.querySelector('#wind-close').onclick = () => {
        // off=exit wind mode
        disableWind(map);
      };

      return div;
    },
    onRemove: () => {}
  });
  const ctl = new C({ position: 'topleft' });
  return ctl;
}

export async function enableWind(map) {

  // California + offshore 5°
  map.fitBounds([[32.0, -130.0], [42.5, -113.0]], { padding: [8,8] });

  if (windLayer) return windLayer;

  const grid = await fetchVelocityJson();

  // adjust map view to the wind data bounds
  try {
    const h = grid[0].header;
    const bounds = [[h.la2, h.lo1], [h.la1, h.lo2]]; // [[S,W],[N,E]]
    map.fitBounds(bounds, { padding: [8, 8] });
  } catch (_) {}

  windLayer = L.velocityLayer({
    data: grid,
    maxVelocity: 25,           // m/s upper limit (affects color bar and speed scale)
    velocityScale: 0.015,      // Particle speed scaling, if it is too slow, increase it
    particleMultiplier: 0.008, // The number of particles is small.
    lineWidth: 1,
    opacity: 0.9
  }).addTo(map);

  //only show the control when wind mode is enabled
  windCtl = makeControl(map);
  map.addControl(windCtl);
  refreshTimer = setInterval(() => refreshWind().catch(error => console.warn("Wind refresh failed:", error)), 60 * 60 * 1000);
}

export function disableWind(map) {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  if (windLayer) { map.removeLayer(windLayer); windLayer = null; }
  if (windCtl) { map.removeControl(windCtl); windCtl = null; }
}

