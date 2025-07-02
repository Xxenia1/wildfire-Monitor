// public/js/wind_mode.js

// globals to persist between calls
let windMap = null;
let svgLayer = null;
let arrowGroup = null;
let currentArrows = [];

/**
 * Fetch wind JSON, build arrows, and draw/animate them.
 */
export function renderWindLayer(map) {
  if (!map) {
    console.error('renderWindLayer: map is null or undefined');
    return;
  }
  windMap = map;

  // 1. On first invocation, create the SVG and group
  if (!svgLayer) {
    svgLayer = d3.select(map.getPanes().overlayPane)
      .append('svg')
      .attr('class', 'leaflet-zoom-animated')
      .style('position', 'absolute')
      .style('pointer-events', 'none');

    arrowGroup = svgLayer.append('g')
      .attr('class', 'leaflet-zoom-hide wind-arrows');

    // Re-draw arrows whenever the map moves or zooms
    map.on('zoomend moveend', updateArrows);
  }

  // 2. Compute today’s URL
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm   = String(today.getMonth() + 1).padStart(2, '0');
  const dd   = String(today.getDate()).padStart(2, '0');
  const filename = `${yyyy}${mm}${dd}_wind.json`;
  const url = `https://storage.googleapis.com/wildfire-monitor-data/wind/${filename}`;

  console.log(`Fetching wind data from: ${url}`);
  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(raw => {
      const windData = Array.isArray(raw) ? raw[0] : raw;
      const { u10, v10, latitude: lats, longitude: lons } = windData;

      // 3. Build a flat array of arrows at your grid step
      const step = 6;
      const latMin = 32, latMax = 42;
      const lonMin = -125, lonMax = -114;
      const arrows = [];

      for (let i = 0; i < u10.length; i += step) {
        for (let j = 0; j < u10[i].length; j += step) {
          const u   = u10[i][j];
          const v   = v10[i][j];
          const lat = lats[i][j];
          const lon = lons[i][j];
          if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
          if (lat < latMin || lat > latMax || lon < lonMin || lon > lonMax) continue;
          arrows.push({ id: `${i}-${j}`, lat, lon, u, v });
        }
      }

      // store & draw
      currentArrows = arrows;
      updateArrows();

      // optionally pan/zoom to CA
      map.flyTo([36.7783, -119.4179], 6);
    })
    .catch(err => console.error('Failed to load wind data:', err));
}

/**
 * Internal: reproject + redraw all arrows.
 */
function updateArrows() {
  if (!windMap || !svgLayer || !arrowGroup) return;

  // get pixel bounds
  const bounds = windMap.getBounds();
  const tl = windMap.latLngToLayerPoint(bounds.getNorthWest());
  const br = windMap.latLngToLayerPoint(bounds.getSouthEast());

  svgLayer
    .attr('width',  br.x - tl.x)
    .attr('height', br.y - tl.y)
    .style('left', `${tl.x}px`)
    .style('top',  `${tl.y}px`);

  arrowGroup.attr('transform', `translate(${-tl.x},${-tl.y})`);

  // helper
  const projectPoint = (lat, lon) => {
    const p = windMap.latLngToLayerPoint([lat, lon]);
    return { x: p.x, y: p.y };
  };

  // D3 join
  const lines = arrowGroup.selectAll('line.wind')
    .data(currentArrows, d => d.id);

  // exit
  lines.exit().remove();

  // enter (start both endpoints at same spot)
  const enter = lines.enter()
    .append('line')
      .attr('class', 'wind')
      .attr('stroke', 'blue')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.6)
      .attr('x1', d => projectPoint(d.lat, d.lon).x)
      .attr('y1', d => projectPoint(d.lat, d.lon).y)
      .attr('x2', d => projectPoint(d.lat, d.lon).x)
      .attr('y2', d => projectPoint(d.lat, d.lon).y);

  // enter + update → animate arrow “growth”
  enter.merge(lines)
    .transition()
      .duration(500)
      .attr('x2', d => {
        const p = projectPoint(d.lat, d.lon);
        return p.x + d.u * 5;
      })
      .attr('y2', d => {
        const p = projectPoint(d.lat, d.lon);
        return p.y + d.v * 5;
      });
}

/**
 * Remove everything when switching modes.
 */
export function removeWindLayer(map) {
  if (svgLayer) {
    svgLayer.remove();
    svgLayer = null;
    arrowGroup = null;
    currentArrows = [];
    if (windMap) {
      windMap.off('zoomend moveend', updateArrows);
      windMap = null;
    }
  }
}
