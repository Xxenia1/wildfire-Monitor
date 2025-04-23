// smoke_mode.js
const smokeLayer = L.layerGroup();
// 1. 在你的 main.js 调用这个函数，并确保 map 已经初始化
export function initSmokeMode(map) {
  smokeLayer.clearLayers();
  if (!map.hasLayer(smokeLayer)) {
    smokeLayer.addTo(map);
  }
  // render data
  fetchSmokeData(smokeLayer);


  // 设置地图视野到加州边界
  const caBounds = [
    [32.53, -124.48],  // southwest  (lat, lng)
    [42.01, -114.13]   // northeast
  ];
  map.fitBounds(caBounds);

  // 如果你想每隔一段时间自动刷新，可取消下面注释：
  // setInterval(() => fetchSmokeData(smokeLayer), 30 * 60 * 1000); // 30 分钟一次
}

function fetchSmokeData(smokeLayer) {
  const API_KEY = '2900B648-68DC-4DA9-8912-108C4DC5B87A';
  const BBOX    = '-124.48,32.53,-114.13,42.01';  // 加州经纬度范围：minLon,minLat,maxLon,maxLat
  const PARAMS  = 'PM25';                        // 也可以加 PM10, OZONE 等，用逗号分隔
  const FORMAT  = 'application/json';

  // 用今天的日期，拉取从 00:00 到 23:59 的当日数据
  const today = new Date().toISOString().slice(0,10);
  const start = `${today}T00-00-00`;
  const end   = `${today}T23-59-59`;

  const url = `https://www.airnowapi.org/aq/observation/bbox/`
    + `?format=${FORMAT}`
    + `&parameters=${PARAMS}`
    + `&BBOX=${BBOX}`
    + `&dataType=A`             // A = AQI
    + `&startDate=${start}`
    + `&endDate=${end}`
    + `&API_KEY=${API_KEY}`;

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`AirNow API error: ${res.status}`);
      return res.json();
    })
    .then(data => {
      smokeLayer.clearLayers();
      data.forEach(obs => {
        const { Latitude, Longitude, AQI, ParameterName, ReportingArea } = obs;
        const color = getAqiColor(AQI);

        // 用 circleMarker 更易于展示
        const marker = L.circleMarker([Latitude, Longitude], {
          radius: 6,
          fillColor: color,
          color: '#333',
          weight: 1,
          fillOpacity: 0.8
        });

        // 弹窗：地点名称 + AQI
        marker.bindPopup(`
          <strong>${ReportingArea}</strong><br/>
          污染物: ${ParameterName}<br/>
          AQI: ${AQI}
        `);

        smokeLayer.addLayer(marker);
      });
    })
    .catch(err => console.error(err));
}

// 根据常见 AQI 分级返回颜色
function getAqiColor(aqi) {
  if (aqi <= 50)  return '#00e400'; // 良好
  if (aqi <= 100) return '#ffff00'; // 轻度
  if (aqi <= 150) return '#ff7e00'; // 中度
  if (aqi <= 200) return '#ff0000'; // 重度
  if (aqi <= 300) return '#8f3f97'; // 严重
  return '#7e0023';              // 危害
}
