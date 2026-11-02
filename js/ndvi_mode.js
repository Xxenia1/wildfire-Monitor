// Historical NDVI animations are served as static files, only when viewed.
let ndviControl = null;
const loadedImages = new Set();

const files = [
  { src: "Data/ca_daily_ndvi_line.gif", title: "Vegetation trend · 2024", detail: "Daily trend animation · 0.9 MB", autoLoad: true },
  { src: "Data/daily_ca_ndvi_2024.gif", title: "Daily NDVI · 2024", detail: "California vegetation animation · 36.8 MB" },
  { src: "Data/ca_ndvi16d_rgb.gif", title: "16-day NDVI composite", detail: "High-resolution animation · 54.0 MB" },
];

function assetUrl(relativePath) {
  return new URL(relativePath, document.baseURI || location.href).toString();
}

function createPanel() {
  const panel = document.createElement("section");
  panel.className = "panel ndvi-panel";
  panel.innerHTML = '<div class="panel-title">Historical NDVI · 2024</div><p class="note">Large animations load only when you choose to view them.</p>';

  for (const file of files) {
    const item = document.createElement("div");
    item.className = "ndvi-item";
    const heading = document.createElement("h3");
    heading.textContent = file.title;
    const detail = document.createElement("p");
    detail.textContent = file.detail;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Load animation";
    item.append(heading, detail, button);

    let image = null;
    button.addEventListener("click", () => {
      if (image) {
        image.removeAttribute("src");
        image.remove();
        loadedImages.delete(image);
        image = null;
        button.textContent = "Load animation";
        return;
      }
      image = document.createElement("img");
      image.alt = file.title;
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => {
        button.textContent = "Animation unavailable — retry";
        loadedImages.delete(image);
        image.remove();
        image = null;
      });
      image.src = assetUrl(file.src);
      loadedImages.add(image);
      item.appendChild(image);
      button.textContent = "Hide animation";
    });
    panel.appendChild(item);
    if (file.autoLoad) button.click();
  }
  return panel;
}

export function initNdviMode(map, { center = [37.5, -119], zoom = 6 } = {}) {
  const host = document.getElementById("sidebar-content");
  if (host) {
    host.replaceChildren(createPanel());
    host.style.display = "block";
  } else if (!ndviControl) {
    const Panel = L.Control.extend({
      options: { position: "topright" },
      onAdd() {
        const panel = createPanel();
        L.DomEvent.disableClickPropagation(panel);
        L.DomEvent.disableScrollPropagation(panel);
        return panel;
      }
    });
    ndviControl = new Panel().addTo(map);
  }
  map.flyTo(center, zoom, { duration: 1.2 });
}

export function removeNdviMode(map) {
  for (const image of loadedImages) image.removeAttribute("src");
  loadedImages.clear();
  const host = document.getElementById("sidebar-content");
  if (host) { host.replaceChildren(); host.style.display = "none"; }
  if (ndviControl) { map.removeControl(ndviControl); ndviControl = null; }
}
