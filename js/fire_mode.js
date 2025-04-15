// // fire_mode.js — main fire mode control panel
// import { addRealtimeLayer, removeRealtimeLayer } from './RT_fire.js';
// import { loadHistoricalLayer, updateFireLayer, removeHistoricalLayer } from './His_fire.js';

// export function initializeFireModeControls(map) {
//   const yearSelect = document.getElementById('year-selector');
//   const timeSlider = document.getElementById('time-slider');
//   const sliderDateLabel = document.getElementById('slider-date-label');

//   document.getElementById('realtime-btn').onclick = () => {
//     removeHistoricalLayer(map);
//     addRealtimeLayer(map);
//   };

//   if (yearSelect && timeSlider && sliderDateLabel) {
//     yearSelect.onchange = async (e) => {
//       const year = e.target.value;
//       await loadHistoricalLayer(map, year);
//       timeSlider.value = '1';
//       sliderDateLabel.innerText = `Day 1`;
//       updateFireLayer(map, parseInt(timeSlider.value));
//     };

//     timeSlider.addEventListener('input', () => {
//       const day = parseInt(timeSlider.value);
//       sliderDateLabel.innerText = `Day ${day}`;
//       updateFireLayer(map, day);
//     });
//   } else {
//     console.warn("Time slider or label not found in DOM.");
//   }
// }
