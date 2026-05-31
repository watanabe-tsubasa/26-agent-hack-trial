import { clearSiteCookie } from "@/lib/demo-auth";

export async function POST() {
  await clearSiteCookie();
  return new Response(null, { status: 204 });
}
