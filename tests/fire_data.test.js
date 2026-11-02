import test from "node:test";
import assert from "node:assert/strict";
import { containmentPercent, reportTimeMs, isRecentUncontained, firmsConfidenceScore } from "../js/fire_data.js";

const now = Date.parse("2026-11-02T00:00:00Z");
const thirtyDays = 30 * 24 * 60 * 60 * 1000;

test("WFIGS containment uses the published attr field without turning missing data into zero", () => {
  assert.equal(containmentPercent({ attr_PercentContained: 100, poly_GISAcres: 55134 }), 100);
  assert.equal(containmentPercent({ attr_PercentContained: null }), null);
  assert.equal(containmentPercent({ attr_PercentContained: 0 }), 0);
});

test("recent report list excludes completed and old perimeters", () => {
  const wfigs = { attr_PercentContained: 97, poly_DateCurrent: Date.parse("2026-10-20T12:00:00Z") };
  assert.equal(isRecentUncontained(wfigs, "wfigs", now, thirtyDays), true);
  assert.equal(isRecentUncontained({ ...wfigs, attr_PercentContained: 100 }, "wfigs", now, thirtyDays), false);
  assert.equal(isRecentUncontained({ ...wfigs, poly_DateCurrent: Date.parse("2026-08-01T00:00:00Z") }, "wfigs", now, thirtyDays), false);
  assert.equal(isRecentUncontained({ PercentContained: 40, Updated: "2026-11-01T00:00:00Z", Final: true }, "calfire", now, thirtyDays), false);
  assert.equal(reportTimeMs(wfigs), wfigs.poly_DateCurrent);
});

test("FIRMS VIIRS letter confidence categories keep distinct marker sizes", () => {
  assert.ok(firmsConfidenceScore("h") > firmsConfidenceScore("n"));
  assert.ok(firmsConfidenceScore("n") > firmsConfidenceScore("l"));
  assert.equal(firmsConfidenceScore(undefined), null);
});
