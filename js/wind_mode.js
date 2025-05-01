// visualization of wind mode
let windLayer = null;

export function renderWindLayer(map) {
  console.log("renderWindLayer triggered");

  if (windLayer) {
    windLayer.remove();
    windLayer = null;
  }

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const filename = `${yyyy}${mm}${dd}_wind.json`;
  const url = `https://storage.googleapis.com/wildfire-monitor-data/wind/${filename}`;

  fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const { u10, v10, latitude, longitude } = data;

      const svgLayer = L.svg();
      svgLayer.addTo(map);
      windLayer = d3.select(".leaflet-overlay-pane svg").append("g").attr("class", "wind-arrows");

      const step = 8;
      const latMin = 32, latMax = 42, lonMin = -125, lonMax = -114;

      for (let i = 0; i < u10.length; i += step) {
        for (let j = 0; j < u10[i].length; j += step) {
          const u = u10[i][j];
          const v = v10[i][j];
          const lat = latitude[i][j];
          const lon = longitude[i][j];

          if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            !Number.isFinite(u) ||
            !Number.isFinite(v)
          ) continue;

          if (lat < latMin || lat > latMax || lon < lonMin || lon > lonMax) continue;

          const point = map.latLngToLayerPoint([lat, lon]);
          const angle = Math.atan2(v, u) * (180 / Math.PI);

          windLayer
            .append("path")
            .attr("d", d3.symbol().type(d3.symbolTriangle).size(30))
            .attr("transform", `translate(${point.x},${point.y}) rotate(${angle})`)
            .style("fill", "#222")
            .style("opacity", 0.7)
            .transition()
            .duration(1000)
            .ease(d3.easeSinInOut)
            .style("opacity", 0.1)
            .transition()
            .duration(1000)
            .style("opacity", 0.7)
            .on("end", function repeat() {
              d3.select(this)
                .transition()
                .duration(1000)
                .style("opacity", 0.1)
                .transition()
                .duration(1000)
                .style("opacity", 0.7)
                .on("end", repeat);
            });
        }
      }

      map.flyTo([36.7783, -119.4179], 6);
    })
    .catch((err) => {
      console.error("Failed to load wind data:", err);
    });
}

export function removeWindLayer(map) {
  if (windLayer) {
    windLayer.remove();
    windLayer = null;
  }
}