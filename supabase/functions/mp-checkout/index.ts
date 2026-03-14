import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUILD = "mp-checkout-2026-03-14-upgrade";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const PLAN_RANK: Record<string, number> = { basic: 1, mid: 2, pro: 3 };

type UserPlanRow = {
  user_id: string;
  plan_id: number | null;
  status: string | null;
  paid_through: string | null;
  started_at: string | null;
  updated_at: string | null;
  mp_preapproval_id: string | null;
  mp_status: string | null;
  current_plan_slug: string | null;
  pending_plan_slug: string | null;
  cancel_at_period_end: boolean | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      "content-type": "application/json; charset=utf-8",
      "x-a360-build": BUILD,
    },
  });
}

function safeStr(x: unknown) {
  return typeof x === "string" ? x : "";
}

function norm(v: unknown) {
  return safeStr(v).trim().toLowerCase();
}

function normOrigin(s: string) {
  return String(s || "").replace(/\/+$/, "");
}

function normBasePath(s: string) {
  let p = String(s || "").trim();
  if (!p) return "";
  if (!p.startsWith("/")) p = "/" + p;
  return p.replace(/\/+$/, "");
}

async function readJsonOnce(res: Response) {
  const text = await res.text().catch(() => "");
  if (!text) return { text: "", json: {} as any };
  try {
    return { text, json: JSON.parse(text) as any };
  } catch {
    return { text, json: { raw: text } as any };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") || "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const SITE_ORIGIN = normOrigin(Deno.env.get("SITE_ORIGIN") || "https://www.maricelconse.com.ar");
    const SITE_BASE_PATH = normBasePath(Deno.env.get("SITE_BASE_PATH") || "/academia360");

    if (!MP_ACCESS_TOKEN) return json({ error: "Missing MP_ACCESS_TOKEN" }, 500);
    if (!SUPABASE_URL) return json({ error: "Missing SUPABASE_URL" }, 500);
    if (!SERVICE_ROLE) return json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

    const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Missing authorization header" }, 401);

    const body = await req.json().catch(() => ({}));
    const planSlug = norm((body as any)?.plan_slug);
    if (!PLAN_RANK[planSlug]) return json({ error: "Missing or invalid plan_slug" }, 400);

    const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: SERVICE_ROLE },
    });
    if (!userRes.ok) {
      const detail = await userRes.text().catch(() => "");
      return json({ error: "Cannot read user from token", status: userRes.status, detail: detail.slice(0, 300) }, 401);
    }

    const user = await userRes.json().catch(() => ({}));
    const user_id = safeStr((user as any)?.id);
    const email = safeStr((user as any)?.email);
    if (!user_id || !email) return json({ error: "User missing id/email" }, 401);

    const { data: plan, error: planErr } = await sbAdmin
      .from("plans")
      .select("id,slug,name,price_ars,currency,mp_preapproval_plan_id")
      .eq("slug", planSlug)
      .maybeSingle();

    if (planErr) return json({ error: "Cannot read plans", detail: planErr.message }, 500);
    if (!plan?.id || !safeStr(plan.mp_preapproval_plan_id)) {
      return json({ error: "Plan invalid or missing mp_preapproval_plan_id", plan_slug: planSlug }, 400);
    }

    const { data: currentRow, error: currentErr } = await sbAdmin
      .from("user_plan")
      .select("user_id,plan_id,status,paid_through,started_at,updated_at,mp_preapproval_id,mp_status,current_plan_slug,pending_plan_slug,cancel_at_period_end")
      .eq("user_id", user_id)
      .maybeSingle<UserPlanRow>();

    if (currentErr) {
      return json({ error: "Cannot read current user_plan", detail: currentErr.message }, 500);
    }

    const currentStatus = norm(currentRow?.status);
    const currentSlug = norm(currentRow?.current_plan_slug);
    const isActive = currentStatus === "active" && !!currentSlug;
    const isUpgrade = isActive && currentSlug !== planSlug;

    if (isActive && currentSlug === planSlug) {
      return json({ error: `Ya tenés activo el plan ${planSlug}.` }, 409);
    }

    if (isActive && PLAN_RANK[planSlug] <= PLAN_RANK[currentSlug]) {
      return json({ error: `Solo está habilitado el upgrade ascendente. Tu plan actual es ${currentSlug}.` }, 400);
    }

    const nowIso = new Date().toISOString();

    const { error: profileErr } = await sbAdmin
      .from("profiles")
      .upsert({
        user_id,
        email,
        requested_plan_slug: planSlug,
        updated_at: nowIso,
      }, { onConflict: "user_id" });

    if (profileErr) {
      return json({ error: "Cannot update profile requested_plan_slug", detail: profileErr.message }, 500);
    }

    const backUrl = `${SITE_ORIGIN}${SITE_BASE_PATH}/app.html?from=mp`;
    const mpBody = {
      preapproval_plan_id: String(plan.mp_preapproval_plan_id),
      payer_email: email,
      external_reference: user_id,
      back_url: backUrl,
      reason: `Academia 360 - ${safeStr(plan.name) || planSlug}`,
      status: "pending",
    };

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mpBody),
    });

    const { json: mpData } = await readJsonOnce(mpRes);

    if (!mpRes.ok) {
      const mpMsg = safeStr(mpData?.message) || safeStr(mpData?.error) || "MP error";
      const causes = Array.isArray(mpData?.cause) ? mpData.cause : [];
      const causeStr = causes
        .map((c: any) => safeStr(c?.description) || safeStr(c?.code))
        .filter(Boolean)
        .join(" | ");

      console.error("[mp-checkout] MP ERROR", { status: mpRes.status, mpMsg, causeStr, mpData });
      return json({ error: mpMsg, mp_status: mpRes.status, cause: causeStr || null, detail: mpData }, mpRes.status);
    }

    const initPoint = safeStr(mpData?.init_point) || safeStr(mpData?.sandbox_init_point);
    const preapprovalId = safeStr(mpData?.id);
    if (!initPoint || !preapprovalId) {
      return json({ error: "MP did not return init_point/id", detail: mpData }, 400);
    }

    let trailError: string | null = null;
    if (isUpgrade && currentRow) {
      const { error: upErr } = await sbAdmin
        .from("user_plan")
        .update({
          pending_plan_slug: planSlug,
          cancel_at_period_end: false,
          updated_at: nowIso,
        })
        .eq("user_id", user_id);
      if (upErr) trailError = upErr.message;
    } else {
      const { error: upErr } = await sbAdmin
        .from("user_plan")
        .upsert({
          user_id,
          plan_id: plan.id,
          status: "past_due",
          paid_through: null,
          started_at: currentRow?.started_at || null,
          updated_at: nowIso,
          mp_preapproval_id: preapprovalId,
          mp_status: "pending",
          current_plan_slug: null,
          pending_plan_slug: planSlug,
          cancel_at_period_end: false,
        }, { onConflict: "user_id" });
      if (upErr) trailError = upErr.message;
    }

    if (trailError) {
      console.error("[mp-checkout] trail write failed", { user_id, planSlug, trailError, isUpgrade, preapprovalId });
    }

    return json({
      url: initPoint,
      preapproval_id: preapprovalId,
      back_url: backUrl,
      mode: isUpgrade ? "upgrade" : "checkout",
      warning: trailError || null,
    }, 200);
  } catch (e) {
    console.error("[mp-checkout] Unhandled:", e);
    return json({ error: String(e) }, 500);
  }
});
