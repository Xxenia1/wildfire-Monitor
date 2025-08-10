// Visualization of Fire Mode

// Fire Perimeter Layer

const CA_BBOX = [-125, 32, -113, 43.5]; // [W,S,E,N]
const WFIGS_PERIMS_QUERY =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query";

function buildPerimeterUrl() {
  const p = new URLSearchParams({
    f: "geojson",
    where: "1=1",
    outFields: "*",
    outSR: "4326",
    geometry: CA_BBOX.join(","),           
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects"
  });
  return `${WFIGS_PERIMS_QUERY}?${p.toString()}`;
}

let _perimeterLayer = null;

export async function enableFire(map) {
  if (_perimeterLayer) {                   // If it has already been loaded, return directly
    _perimeterLayer.addTo(map);
    return _perimeterLayer;
  }
  const url = buildPerimeterUrl();
  const gj = await fetch(url).then(r => {
    if (!r.ok) throw new Error(`WFIGS HTTP ${r.status}`);
    return r.json();
  });

  // Style: Orange for incomplete control, green for highly controlled fields (field name error tolerance)
  const style = (f) => {
    const p = f.properties || {};
    const pct = p.percentcontained ?? p.poly_PercentContained ?? p.PERCENT_CONTAINED;
    const color = (Number(pct) >= 70) ? "#2e7d32" : "#ff6d00";
    return { color, weight: 2, fillOpacity: 0.1 };
  };

  _perimeterLayer = L.geoJSON(gj, {
    style,
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      const name = p.incidentname || p.poly_IncidentName || p.IncidentName || "Fire";
      const acres = p.gisacres ?? p.poly_GISAcres ?? p.GISAcres;
      const pct = p.percentcontained ?? p.poly_PercentContained ?? p.PERCENT_CONTAINED;
      const updated = p.irwinmodifiedondate || p.modifiedondate || p.CreateDate || p.poly_CreateDate;

      l.bindPopup(
        `<b>${name}</b><br/>
         Acres: ${acres ?? "—"}<br/>
         Contained: ${pct ?? "—"}%<br/>
         Updated: ${updated ?? "—"}`
      );
    }
  }).addTo(map);

  return _perimeterLayer;
}

export function disableFire(map) {
  if (_perimeterLayer) {
    map.removeLayer(_perimeterLayer);
  }
}
