// visualization of wind mode
let windLayerGroup;

// Main entry point: fetch today's JSON file and render the wind arrows
export async function renderWindMode(map) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const filename = `${yyyy}${mm}${dd}_wind.json`;

  // Construct the full GCS URL for today's file
  const url = `https://storage.googleapis.com/wildfire-monitor-data/wind/${filename}`;

  try {
    const res = await fetch(url);
    const data = await res.json(); // { u: [...], v: [...] }
  
    const u = data.u;
    const v = data.v;
  
    if (Array.isArray(u) && Array.isArray(v) && u.length === v.length) {
      
      const windArray = u.map((row, i) => {
        return row.map((uVal, j) => {
          return [uVal, v[i][j]];
        });
      });
  
      renderWindLayer(windArray); 
    } else {
      console.error("Invalid wind data format:", data);
    }
  } catch (err) {
    console.error('Failed to load wind data:', err);
  }  
}

// Render arrow layer given wind data
export function renderWindLayer(windData) {
    if (!Array.isArray(windData)) {
        console.error("windData is not an array:", windData);
        return;
    }

    // 假设 windData 是一个二维数组，每个元素是 [u, v]
    windData.forEach((row, latIdx) => {
        if (!Array.isArray(row)) return;

        row.forEach((windVal, lonIdx) => {
            if (Array.isArray(windVal) && windVal.length === 2) {
                const [u, v] = windVal;

                if (!isNaN(u) && !isNaN(v)) {
                    // 计算箭头角度和强度
                    const angle = Math.atan2(v, u);
                    const speed = Math.sqrt(u * u + v * v);

                    // 计算该箭头的地理坐标（根据你的格网和范围调整）
                    const lon = -130 + lonIdx * 0.25; // 举例：从 -130° 开始每格 0.25°
                    const lat = 50 - latIdx * 0.25;   // 举例：从 50°N 开始向下每格 0.25°

                    // 添加箭头（使用 Leaflet Polyline 或 SVG 渲染）
                    const arrow = L.polyline([
                        [lat, lon],
                        [lat + 0.1 * v, lon + 0.1 * u]
                    ], {
                        color: 'blue',
                        weight: 1,
                        opacity: 0.7
                    }).addTo(map);
                }
            }
        });
    });
}

  
// Optional cleanup function (removes wind layer)
export function removeWindLayer(map) {
  if (windLayerGroup) {
    map.removeLayer(windLayerGroup);
    windLayerGroup = null;
  }
}
