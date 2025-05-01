// visualization of wind mode
let windLayerGroup = null;
let svgLayer = null;

export function renderWindLayer(map) {
  console.log('renderWindLayer triggered');

  if (!map) {
    console.error('map is null or undefined');
    return;
  }

  // Remove previous layer if exists
  if (svgLayer) {
    svgLayer.remove();
    svgLayer = null;
  }

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const filename = `${yyyy}${mm}${dd}_wind.json`;
  const url = `https://storage.googleapis.com/wildfire-monitor-data/wind/${filename}`;

  console.log(`Fetching wind data from: ${url}`);

  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(windData => {
      console.log('[DEBUG] windData keys:', Object.keys(windData));
      console.log('[DEBUG] Sample u10[0]:', windData.u10?.[0]);

      if (Array.isArray(windData)) {
        console.warn("[WARN] windData is an array, using windData[0] instead.");
        windData = windData[0];
      }

      const { u10, v10, latitude: lats, longitude: lons } = windData;

      // check
      if (!windData || !windData.u10 || !windData.v10) {
        throw new Error("Wind data is undefined or malformed.");
      }

      // Create SVG overlay
      svgLayer = d3.select(map.getPanes().overlayPane)
        .append("svg")
        .attr("class", "leaflet-zoom-animated")
        .style("position", "absolute")
        .style("pointer-events", "none");

      const g = svgLayer.append("g").attr("class", "leaflet-zoom-hide");

      const projectPoint = (lat, lon) => {
        return map.latLngToLayerPoint([lat, lon]);
      };

      const latMin = 32, latMax = 42;
      const lonMin = -125, lonMax = -114;
      const step = 6;

      const arrows = [];

      for (let i = 0; i < u10.length; i += step) {
        for (let j = 0; j < u10[i].length; j += step) {
          const u = u10[i][j];
          const v = v10[i][j];
          const lat = lats[i][j];
          const lon = lons[i][j];

          if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
          if (lat < latMin || lat > latMax || lon < lonMin || lon > lonMax) continue;

          arrows.push({ lat, lon, u, v });
        }
      }

      const updateArrows = () => {
        const bounds = map.getBounds();
        const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
        const bottomRight = map.latLngToLayerPoint(bounds.getSouthEast());

        svgLayer
          .attr("width", bottomRight.x - topLeft.x)
          .attr("height", bottomRight.y - topLeft.y)
          .style("left", `${topLeft.x}px`)
          .style("top", `${topLeft.y}px`);

        g.attr("transform", `translate(${-topLeft.x},${-topLeft.y})`);

        const selection = g.selectAll("line")
          .data(arrows, d => `${d.lat}-${d.lon}`);

        selection.enter()
          .append("line")
          .attr("x1", d => projectPoint(d.lat, d.lon).x)
          .attr("y1", d => projectPoint(d.lat, d.lon).y)
          .attr("x2", d => projectPoint(d.lat, d.lon).x + d.u * 5)
          .attr("y2", d => projectPoint(d.lat, d.lon).y + d.v * 5)
          .attr("stroke", "blue")
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.6)
          .merge(selection)
          .transition()
          .duration(500)
          .attr("x2", d => projectPoint(d.lat, d.lon).x + d.u * 5)
          .attr("y2", d => projectPoint(d.lat, d.lon).y + d.v * 5);

        selection.exit().remove();
      };

      map.on("zoomend moveend", updateArrows);
      updateArrows();

      map.flyTo([36.7783, -119.4179], 6);
    })
    .catch(error => {
      console.error("Failed to load wind data:", error);
    });
}

export function removeWindLayer(map) {
  if (svgLayer) {
    svgLayer.remove();
    svgLayer = null;
  }
}
