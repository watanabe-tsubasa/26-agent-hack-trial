import test from "node:test";
import assert from "node:assert/strict";
import { buildReportSearchClause } from "../reports/report-search";

test("only facilityId: produces single condition", () => {
  const { where, params } = buildReportSearchClause({ facilityId: "kanda-office" });
  assert.ok(where.includes("facilityId"));
  assert.equal(params.length, 1);
  assert.equal(params[0].value, "kanda-office");
});

test("keyword: adds LIKE clause with wildcards", () => {
  const { where, params } = buildReportSearchClause({
    facilityId: "kanda-office",
    keyword: "転倒",
  });
  assert.ok(where.includes("summary like @keyword"));
  const kw = params.find((p) => p.name === "keyword");
  assert.equal(kw?.value, "%転倒%");
});

test("status: skipped for 'all'", () => {
  const { where, params } = buildReportSearchClause({
    facilityId: "kanda-office",
    status: "all",
  });
  assert.ok(!where.includes("status = @status"));
  assert.equal(params.find((p) => p.name === "status"), undefined);
});

test("status: included when specific value", () => {
  const { where, params } = buildReportSearchClause({
    facilityId: "kanda-office",
    status: "confirmed",
  });
  assert.ok(where.includes("status = @status"));
  assert.equal(params.find((p) => p.name === "status")?.value, "confirmed");
});

test("from/to: parsed as Date params", () => {
  const { where, params } = buildReportSearchClause({
    facilityId: "kanda-office",
    from: "2026-05-01",
    to: "2026-05-31",
  });
  assert.ok(where.includes("created_at >= @fromDate"));
  assert.ok(where.includes("created_at <= @toDate"));
  assert.ok(params.find((p) => p.name === "fromDate")?.value instanceof Date);
  assert.ok(params.find((p) => p.name === "toDate")?.value instanceof Date);
});

test("invalid date: skipped", () => {
  const { where } = buildReportSearchClause({
    facilityId: "kanda-office",
    from: "not-a-date",
  });
  assert.ok(!where.includes("created_at >= @fromDate"));
});
