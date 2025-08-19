// ndvi_mode.js — NDVI 面板（支持用已有的 #sidebar-content，或者自动做一个 Leaflet 控件）
let _ndviCtl = null;

function assetUrl(rel) {
  const base = document.baseURI || location.href;
  return new URL(String(rel || "").replace(/^\/+/, ""), base).toString();
}

// 你现在的 3 张动图；路径照你项目来，想加/删都可以
const NDVI_FILES = [
  { src: "Data/daily_ca_ndvi_2024.gif", alt: "NDVI Daily 2024" },
  { src: "Data/ca_ndvi16d_rgb.gif",    alt: "NDVI 16-day RGB" },
  { src: "Data/ca_daily_ndvi_line.gif", alt: "California NDVI Line Animation" },
];

/**
 * 显示 NDVI 面板
 * - 优先往页面里的 #sidebar-content 渲染；
 * - 如果页面没有这个容器，就做一个 Leaflet Control 贴在右上角；
 */
export function initNdviMode(map, { center = [37.5, -119], zoom = 6 } = {}) {
  // 方案 A：页面已有容器（你现在的写法）
  const host = document.getElementById("sidebar-content");
  if (host) {
    host.style.display = "block";
    host.innerHTML = `
      <div class="panel ndvi-panel">
        <div class="panel-title">NDVI</div>
        <div class="ndvi-list"></div>
      </div>`;
    const list = host.querySelector(".ndvi-list");
    NDVI_FILES.forEach(f => {
      const img = new Image();
      img.src = assetUrl(f.src);
      img.alt = f.alt;
      img.loading = "lazy";
      img.style.width = "100%";
      img.style.display = "block";
      img.style.margin = "8px 0";
      list.appendChild(img);
    });
    map.flyTo(center, zoom, { duration: 1.2 });
    return;
  }

  // 方案 B：自动生成一个 Leaflet 控件（无需依赖页面容器）
  if (_ndviCtl) { _ndviCtl.addTo(map); map.flyTo(center, zoom, { duration: 1.2 }); return; }

  const Panel = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const div = L.DomUtil.create("div", "panel ndvi-panel");
      div.innerHTML = `<div class="panel-title">NDVI</div>`;
      NDVI_FILES.forEach(f => {
        const img = new Image();
        img.src = assetUrl(f.src);
        img.alt = f.alt;
        img.loading = "lazy";
        img.style.width = "260px";            // 控件里的宽度
        img.style.display = "block";
        img.style.margin = "8px 0";
        div.appendChild(img);
      });
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      return div;
    }
  });
  _ndviCtl = new Panel().addTo(map);
  map.flyTo(center, zoom, { duration: 1.2 });
}

/** 隐藏 NDVI 面板（两种渲染方式都兼容） */
export function removeNdviMode(map) {
  const host = document.getElementById("sidebar-content");
  if (host) { host.innerHTML = ""; host.style.display = "none"; }
  if (_ndviCtl) { try { map.removeControl(_ndviCtl); } catch {} _ndviCtl = null; }
}

  