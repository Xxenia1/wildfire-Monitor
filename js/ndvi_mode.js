// display NDVI gif & line graph
export function initNdviMode(map) {
    const sidebar = document.getElementById("sidebar-content");
    if (!sidebar) return;

    sidebar.style.display = 'block';
    sidebar.innerHTML = ''; 
  
    // insert NDVI gif
    const ndviFiles = [
        { src: "Data/daily_ca_ndvi_2024.gif", alt: "NDVI Daily 2024" },
        { src: "Data/ca_ndvi16d_rgb.gif", alt: "NDVI 16-day RGB" },
        { src: "Data/ca_daily_ndvi_line.gif", alt: "California NDVI Line Animation" }
      ];

      ndviFiles.forEach(file => {
        const gif = document.createElement("img");
        gif.src = file.src;
        gif.alt = file.alt;
        sidebar.appendChild(gif);
    });
    map.flyTo([37.5, -119], 6, {duration: 2});
}
  