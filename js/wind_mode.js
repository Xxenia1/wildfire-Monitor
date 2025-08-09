// visualization of wind mode（leaflet-velocity）

let windLayer = null;
let windCtl = null;

async function fetchVelocityJson() {
  // Add a timestamp to prevent caching
  const url = `./Data/Wind/wind_ca_velocity.json?t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch wind json failed: ${res.status}`);
  return res.json();
}

//Use Leaflet Control to make a small toolbar that only appears in wind mode
function makeControl(map) {
  // 用 Leaflet Control 做个小工具条，只在风模式时显示
  const C = L.Control.extend({
    onAdd: () => {
      const div = L.DomUtil.create('div', 'wind-toolbar');
      div.innerHTML = `
        <button class="wind-btn" id="wind-refresh" title="Refresh">↻</button>
        <button class="wind-btn" id="wind-close"   title="Close">✕</button>
      `;
      // 防止拖地图时选中文本/冒泡
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);

      div.querySelector('#wind-refresh').onclick = async () => {
        try {
          const data = await fetchVelocity();
          if (windLayer && typeof windLayer.setData === 'function') {
            windLayer.setData(data);
          } else if (windLayer) {
            const m = windLayer._map;
            m.removeLayer(windLayer);
            windLayer = L.velocityLayer({ data, maxVelocity: 25, velocityScale: 0.015, particleMultiplier: 0.008, opacity: 0.9, lineWidth: 1 });
            windLayer.addTo(m);
          }
        } catch (e) { console.error(e); alert('刷新失败'); }
      };

      div.querySelector('#wind-close').onclick = () => {
        // 关闭=退出风模式
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

  // 加州 + 外海 5°
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
    maxVelocity: 25,           // m/s 上限（影响色条和速度比例）
    velocityScale: 0.015,      // 粒子速度缩放，太慢就调大
    particleMultiplier: 0.008, // 粒子数量，卡就调小
    lineWidth: 1,
    opacity: 0.9
  }).addTo(map);

  //only show the control when wind mode is enabled
  windCtl = makeControl(map);
  map.addControl(windCtl);
}

export function disableWind(map) {
  if (!windLayer) return;
  map.removeLayer(windLayer);
  windLayer = null;
}

