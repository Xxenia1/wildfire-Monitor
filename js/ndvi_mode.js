// display NDVI gif & line graph
export function initNdviMode() {
    const sidebar = document.getElementById("sidebar-content");
  
    // 清空之前的内容（比如之前点过 Smoke 或 Fire）
    //sidebar.innerHTML = "";
  
    // 插入 NDVI GIF
    const gif = document.createElement("img");
    gif.src = "Data/daily_ca_ndvi_2024.gif"; // 路径确保正确
    gif.alt = "California NDVI 2024";
    gif.style.width = "100%";
  
    sidebar.appendChild(gif);
  }
  