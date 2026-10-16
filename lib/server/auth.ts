import "server-only";
import { sessionClient, adminClient } from "../supabase/server";
import { AppError, checked } from "./errors";
export async function auth(request?: Request) {
  if (request && request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (origin) {
      const target = new URL(request.url);
      const expectedHost = request.headers.get("host") || target.host;
      let allowed = false;
      try {
        const source = new URL(origin);
        allowed =
          source.host === expectedHost && source.protocol === target.protocol;
      } catch {
        /* An invalid Origin must never bypass CSRF checks. */
      }
      if (!allowed)
        throw new AppError("FORBIDDEN", "This request is not allowed.", 403);
    }
  }
  const supabase = await sessionClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user)
    throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  return { user, db: adminClient() };
}
export async function quota(
  db: ReturnType<typeof adminClient>,
  userId: string,
  scope: string,
  limit: number,
  seconds = 3600,
) {
  const allowed = checked(
    await db.rpc("take_quota", {
      p_user: userId,
      p_scope: scope,
      p_limit: limit,
      p_window: seconds,
    }),
  );
  if (!allowed)
    throw new AppError("RATE_LIMITED", "Please wait before trying again.", 429);
}
export async function ownedScan(
  db: ReturnType<typeof adminClient>,
  userId: string,
  id: string,
) {
  const result = await db
    .from("skin_scans")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  checked(result);
  if (!result.data)
    throw new AppError("NOT_FOUND", "This scan is not available.", 404);
  return result.data;
}
export async function ownedExperiment(
  db: ReturnType<typeof adminClient>,
  userId: string,
  id: string,
) {
  const result = await db
    .from("skincare_experiments")
    .select("*, product_usage_logs(*)")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  checked(result);
  if (!result.data)
    throw new AppError("NOT_FOUND", "This experiment is not available.", 404);
  return result.data;
}
export const scanSelect =
  "id,status,overall_score,skin_age,created_at,completed_at,error_message,provider_version,capture_notes,skin_scan_metrics(*),skin_type_results(*)";
