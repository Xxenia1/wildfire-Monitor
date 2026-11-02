const firstNumber = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
};

export function containmentPercent(properties = {}) {
  const value = firstNumber(
    properties.attr_PercentContained,
    properties.PercentContained,
    properties.percentcontained,
    properties.poly_PercentContained,
    properties.PERCENT_CONTAINED,
  );
  return value !== null && value >= 0 && value <= 100 ? value : null;
}

export function reportTimeMs(properties = {}, source = "wfigs") {
  const values = source === "calfire"
    ? [properties.Updated, properties.ModifiedOnDate, properties.UpdateDate]
    : [properties.poly_DateCurrent, properties.poly_PolygonDateTime, properties.attr_ModifiedOnDateTime_dt];
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const ms = typeof value === "number" ? value : Date.parse(value);
    if (Number.isFinite(ms) && ms > 0) return ms;
  }
  return null;
}

export function isRecentUncontained(properties, source, nowMs, maxAgeMs) {
  const pct = containmentPercent(properties);
  const updated = reportTimeMs(properties, source);
  if (pct === null || pct >= 100 || updated === null) return false;
  if (updated > nowMs || nowMs - updated > maxAgeMs) return false;
  if (source === "calfire" && (properties.Final === true || properties.IsActive === false)) return false;
  if (source === "wfigs" && properties.attr_FireOutDateTime) return false;
  return true;
}

export function firmsConfidenceScore(value) {
  if (typeof value === "string") {
    const category = value.trim().toLowerCase();
    if (category === "h") return 90;
    if (category === "n") return 50;
    if (category === "l") return 10;
  }
  const numeric = firstNumber(value);
  return numeric === null ? null : Math.max(0, Math.min(100, numeric));
}
