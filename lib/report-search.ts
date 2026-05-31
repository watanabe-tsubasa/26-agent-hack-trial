export type ReportSearchQuery = {
  facilityId: string;
  keyword?: string;
  status?: string;
  from?: string;
  to?: string;
};

export type BuiltClause = {
  where: string;
  params: { name: string; value: string | Date }[];
};

export const SEARCHABLE_STATUSES = [
  "queued",
  "generating_report",
  "waiting_human_review",
  "confirmed",
  "failed",
] as const;

export function buildReportSearchClause(query: ReportSearchQuery): BuiltClause {
  const conditions: string[] = ["JSON_VALUE(input_json, '$.facilityId') = @facilityId"];
  const params: { name: string; value: string | Date }[] = [
    { name: "facilityId", value: query.facilityId },
  ];

  if (query.keyword && query.keyword.trim()) {
    const value = `%${query.keyword.trim()}%`;
    conditions.push(
      "(summary like @keyword or input_json like @keyword or isnull(user_draft_json, '') like @keyword or isnull(ai_draft_json, '') like @keyword)"
    );
    params.push({ name: "keyword", value });
  }

  if (query.status && query.status !== "all" && query.status !== "") {
    conditions.push("status = @status");
    params.push({ name: "status", value: query.status });
  }

  if (query.from) {
    const fromDate = new Date(query.from);
    if (!Number.isNaN(fromDate.getTime())) {
      conditions.push("created_at >= @fromDate");
      params.push({ name: "fromDate", value: fromDate });
    }
  }

  if (query.to) {
    const toDate = new Date(query.to);
    if (!Number.isNaN(toDate.getTime())) {
      conditions.push("created_at <= @toDate");
      params.push({ name: "toDate", value: toDate });
    }
  }

  return { where: `where ${conditions.join(" and ")}`, params };
}
