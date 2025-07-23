// Establish Fire Mode
let firePointsLayer = null;

// CA Bounding box
const CA_BOUNDS = {
    minLat: 32.5,
    maxLat: 42.1,
    minLng: -124.5,
    maxLng: -114.1
  };
  export async function initFirePointsLayer(map) {
    // Remove previous layer if exists
    if (firePointsLayer) {
      map.removeLayer(firePointsLayer);
    }
  
    // NASA FIRMS USA (including CA) - VIIRS, 24h, public API
    const url = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/viirs/geojson/USA_contiguous_and_Hawaii_24h.geojson';
  
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch FIRMS fire data.');
      const geojson = await response.json();
  
      // Filter features to California bounds
      geojson.features = geojson.features.filter(f => {
        const [lng, lat] = f.geometry.coordinates;
        return lat >= CA_BOUNDS.minLat && lat <= CA_BOUNDS.maxLat &&
               lng >= CA_BOUNDS.minLng && lng <= CA_BOUNDS.maxLng;
      });
  
      // Add points to the map
      firePointsLayer = L.geoJSON(geojson, {
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
          radius: getRadius(feature.properties.frp),
          color: getColor(feature.properties.acq_date, feature.properties.acq_time),
          fillOpacity: 0.7,
          weight: 1
        }),
        onEachFeature: (feature, layer) => {
          layer.bindPopup(getPopupContent(feature));
        }
      }).addTo(map);
  
    } catch (err) {
      console.error(err);
      alert('Failed to load California fire points data!');
    }
  }
  
  // Helper functions
  
  function getRadius(frp) {
    if (!frp) return 4;
    if (frp < 10) return 4;
    if (frp < 30) return 6;
    if (frp < 80) return 8;
    return 10;
  }
  
  function getColor(date, time) {
    // Color can be mapped based on detection time; simple example here
    return "#ff7800";
  }
  
  function getPopupContent(feature) {
    const p = feature.properties;
    return `
      <b>Acquisition:</b> ${p.acq_date} ${p.acq_time}<br>
      <b>FRP:</b> ${p.frp}<br>
      <b>Confidence:</b> ${p.confidence}<br>
      <b>Latitude:</b> ${p.latitude}<br>
      <b>Longitude:</b> ${p.longitude}
    `;
  }
  