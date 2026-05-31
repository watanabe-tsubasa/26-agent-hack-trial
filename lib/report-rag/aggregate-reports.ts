import { getDbPool } from "../db";
import { findSiteByKey } from "../auth/demo-sites";
import { INDEXABLE_STATUSES } from "./types";

export type FacilityAggregate = {
  facilityId: string;
  siteName: string;
  count: number;
};

export async function aggregateReportsByFacility(): Promise<FacilityAggregate[]> {
  const pool = await getDbPool();
  const statusList = INDEXABLE_STATUSES.map((s) => `'${s}'`).join(",");
  const result = await pool.request().query<{ facility_id: string | null; n: number }>(`
    select JSON_VALUE(input_json, '$.facilityId') as facility_id,
           count(*) as n
    from reports
    where status in (${statusList})
    group by JSON_VALUE(input_json, '$.facilityId')
    order by n desc
  `);

  return result.recordset
    .filter((r) => !!r.facility_id)
    .map((r) => {
      const site = findSiteByKey(r.facility_id);
      return {
        facilityId: r.facility_id!,
        siteName: site?.name ?? r.facility_id!,
        count: Number(r.n),
      };
    });
}
