const state = new Map();
const modes = {
  fire: ["WFIGS", "FIRMS", "CAL FIRE"],
  wind: ["Wind"],
  smoke: ["Smoke"],
  ndvi: ["NDVI"],
};
const timeKinds = { WFIGS: "fetched", FIRMS: "fetched", "CAL FIRE": "fetched", Wind: "model", Smoke: "observed" };
const displayNames = { Smoke: "AirNow PM₂.₅" };
let activeMode = "fire";

function render() {
  const host = document.getElementById("data-status");
  if (!host) return;
  host.replaceChildren();
  for (const name of modes[activeMode] || []) {
    const displayName = displayNames[name] || name;
    const value = state.get(name);
    const badge = document.createElement("span");
    badge.className = "data-status-badge";
    if (name === "NDVI") {
      badge.textContent = "NDVI: historical (2024)";
    } else if (!value) {
      badge.textContent = `${displayName}: loading`;
    } else if (!value.timestamp) {
      badge.classList.add("data-status-stale");
      badge.textContent = `${displayName}: ${value.failed ? "unavailable" : "update time unknown"}`;
    } else {
      const age = Date.now() - Date.parse(value.timestamp);
      const stale = value.failed || !Number.isFinite(age) || age > value.maxAgeMs;
      if (stale) badge.classList.add("data-status-stale");
      const date = new Date(value.timestamp);
      const time = date.toLocaleString();
      const shortTime = date.toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
      badge.textContent = `${displayName} ${timeKinds[name] || "updated"}: ${shortTime}${stale ? " (old)" : ""}`;
      badge.title = `${timeKinds[name] === "fetched" ? "Snapshot fetched" : "Data time"}: ${time}${name === "WFIGS" ? "; individual perimeters can be older" : ""}${value.failed ? "; latest refresh failed" : ""}`;
    }
    host.appendChild(badge);
  }
}

export function setActiveMode(mode) { activeMode = mode; render(); }
export function setDataStatus(name, timestamp, maxAgeMs) {
  state.set(name, { timestamp: timestamp || null, maxAgeMs, failed: false });
  render();
}
export function setDataError(name) {
  const previous = state.get(name);
  state.set(name, { timestamp: previous?.timestamp || null, maxAgeMs: previous?.maxAgeMs || 0, failed: true });
  render();
}

setInterval(render, 60 * 1000);
