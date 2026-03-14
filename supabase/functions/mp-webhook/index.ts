import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown>;
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

const BUILD = "mp-webhook-2026-03-14-upgrade";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const PLAN_BY_PREAPPROVAL: Record<string, string> = {
  a744205529154c91bdfe7811443a9e41: "basic",
  b003ccd51f3d49c59d3daf76315bb9d6: "mid",
  "4e5b56a866274858ad36638487349115": "pro",
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

function isUuid(v: string) {
  return /^[0-9a-f-]{36}$/i.test(v);
}

async function safeReadJsonOrText(req: Request): Promise<{ payload: Json | null; rawText: string | null }> {
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const p = (await req.json()) as Json;
      return { payload: p, rawText: null };
    }
    const t = await req.text();
    return { payload: { raw: t }, rawText: t };
  } catch {
    return { payload: { raw: "" }, rawText: "" };
  }
}

function normalizeStatus(topic: string, rawStatus: string) {
  const s = norm(rawStatus);
  const t = norm(topic);
  if (["authorized", "active", "approved", "processed"].includes(s)) return "active";
  if (["cancelled", "canceled", "paused"].includes(s)) return "canceled";
  if (t === "subscription_authorized_payment" && ["rejected", "refunded", "charged_back"].includes(s)) return "past_due";
  return "past_due";
}

function plusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function cancelSubscription(preapprovalId: string, token: string) {
  if (!preapprovalId) return { ok: false, skipped: true };
  const res = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(preapprovalId)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "cancelled" }),
  });
  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") || "";

  if (!SUPABASE_URL || !SERVICE_ROLE || !MP_ACCESS_TOKEN) {
    console.error("[mp-webhook] Missing env vars", {
      SUPABASE_URL: !!SUPABASE_URL,
      SERVICE_ROLE: !!SERVICE_ROLE,
      MP_ACCESS_TOKEN: !!MP_ACCESS_TOKEN,
    });
    return json({ ok: true, received: true, warn: "missing env vars" }, 200);
  }

  const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const url = new URL(req.url);
  const topic = (url.searchParams.get("topic") || url.searchParams.get("type") || "").trim();
  const action = (url.searchParams.get("action") || "").trim();

  let dataId =
    (url.searchParams.get("data.id") ||
      url.searchParams.get("data_id") ||
      url.searchParams.get("id") ||
      "").trim();

  const { payload } = await safeReadJsonOrText(req);
  try {
    const bodyData = (payload as any)?.data;
    if (!dataId && bodyData?.id) dataId = String(bodyData.id);
  } catch {
    // ignore
  }

  const requestId = req.headers.get("x-request-id") || null;
  const dedupeKey = `${topic}:${action}:${dataId}:${requestId ?? "no-reqid"}`;

  const ins = await sbAdmin
    .from("subscriptions_events")
    .insert({
      provider: "mercadopago",
      topic,
      action,
      mp_id: dataId,
      event_type: "webhook",
      request_id: requestId,
      headers: Object.fromEntries(req.headers.entries()),
      payload,
      dedupe_key: dedupeKey,
    })
    .select("id")
    .maybeSingle();

  if (ins.error) {
    if ((ins.error as any)?.code === "23505") return json({ ok: true, deduped: true }, 200);
    return json({ ok: false, error: ins.error.message }, 500);
  }

  const eventId = ins.data?.id ?? null;
  if (!dataId) {
    if (eventId) {
      await sbAdmin
        .from("subscriptions_events")
        .update({ processing_error: "missing data.id", processed_at: new Date().toISOString() })
        .eq("id", eventId);
    }
    return json({ ok: true, event_id: eventId, updated: false, reason: "missing data.id" }, 200);
  }

  let resource: Json | null = null;
  let mpStatus = "";
  let payerEmail = "";
  let externalRef = "";
  let preapprovalPlanId = "";
  let preapprovalId = "";

  const t = norm(topic);

  try {
    const apiUrl =
      t === "payment" || t === "payments"
        ? `https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`
        : t === "subscription_authorized_payment"
          ? `https://api.mercadopago.com/authorized_payments/${encodeURIComponent(dataId)}`
          : `https://api.mercadopago.com/preapproval/${encodeURIComponent(dataId)}`;

    const r = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    resource = r.ok ? ((await r.json()) as Json) : { http_status: r.status, api_url: apiUrl };
    mpStatus = safeStr((resource as any)?.status);
    externalRef =
      safeStr((resource as any)?.external_reference) ||
      safeStr((resource as any)?.metadata?.external_reference) ||
      "";
    payerEmail =
      safeStr((resource as any)?.payer_email) ||
      safeStr((resource as any)?.payer?.email) ||
      "";
    preapprovalPlanId =
      safeStr((resource as any)?.preapproval_plan_id) ||
      safeStr((resource as any)?.preapproval?.preapproval_plan_id) ||
      "";
    preapprovalId =
      safeStr((resource as any)?.preapproval_id) ||
      safeStr((resource as any)?.preapproval?.id) ||
      "";
  } catch (e) {
    resource = { error: String(e) };
  }

  const effectivePreapprovalId = t === "subscription_authorized_payment" && preapprovalId ? preapprovalId : dataId;
  const normalized = normalizeStatus(topic, mpStatus);

  let userId = externalRef;
  if (!userId || !isUuid(userId)) {
    const q = await sbAdmin
      .from("user_plan")
      .select("user_id")
      .eq("mp_preapproval_id", effectivePreapprovalId)
      .maybeSingle();
    userId = safeStr(q.data?.user_id);
  }

  if (!userId || !isUuid(userId)) {
    if (eventId) {
      await sbAdmin
        .from("subscriptions_events")
        .update({
          resource,
          status: mpStatus || null,
          email: payerEmail || null,
          processing_error: "missing external_reference user_id (and cannot resolve by mp_preapproval_id)",
          processed_at: new Date().toISOString(),
        })
        .eq("id", eventId);
    }
    return json({ ok: true, event_id: eventId, updated: false, reason: "missing user_id" }, 200);
  }

  const { data: existingRow } = await sbAdmin
    .from("user_plan")
    .select("user_id,plan_id,status,paid_through,started_at,updated_at,mp_preapproval_id,mp_status,current_plan_slug,pending_plan_slug,cancel_at_period_end")
    .eq("user_id", userId)
    .maybeSingle<UserPlanRow>();

  let planSlug = PLAN_BY_PREAPPROVAL[preapprovalPlanId] || "";
  if (!planSlug) planSlug = norm(existingRow?.pending_plan_slug);
  if (!planSlug) planSlug = norm(existingRow?.current_plan_slug);
  if (!planSlug) {
    const { data: profileRow } = await sbAdmin
      .from("profiles")
      .select("requested_plan_slug")
      .eq("user_id", userId)
      .maybeSingle();
    planSlug = norm((profileRow as any)?.requested_plan_slug);
  }

  let planId: number | null = null;
  if (planSlug) {
    const p = await sbAdmin.from("plans").select("id").eq("slug", planSlug).maybeSingle();
    planId = p.data?.id ?? null;
  }
  if (!planId) planId = existingRow?.plan_id ?? null;

  if (!planSlug || !planId) {
    if (eventId) {
      await sbAdmin
        .from("subscriptions_events")
        .update({
          resource,
          status: mpStatus || null,
          email: payerEmail || null,
          user_id: userId,
          processing_error: `missing plan resolution (preapproval_plan_id=${preapprovalPlanId} planSlug=${planSlug || ""})`,
          processed_at: new Date().toISOString(),
        })
        .eq("id", eventId);
    }
    return json({ ok: true, event_id: eventId, updated: false, reason: "missing plan_id" }, 200);
  }

  let paidThrough: string | null = null;
  const nextPay = safeStr((resource as any)?.next_payment_date);
  if (nextPay) {
    const d = new Date(nextPay);
    if (!Number.isNaN(d.getTime())) {
      d.setDate(d.getDate() - 1);
      paidThrough = d.toISOString();
    }
  }

  const existingStatus = norm(existingRow?.status);
  const existingCurrentSlug = norm(existingRow?.current_plan_slug);
  const isExistingActive = existingStatus === "active" && !!existingCurrentSlug;
  const isUpgradeAttempt = isExistingActive && !!planSlug && existingCurrentSlug !== planSlug;
  const nowIso = new Date().toISOString();

  if (eventId) {
    await sbAdmin
      .from("subscriptions_events")
      .update({
        resource,
        status: mpStatus || null,
        email: payerEmail || null,
        user_id: userId,
        plan_slug: planSlug || null,
        processed_at: nowIso,
      })
      .eq("id", eventId);
  }

  if (normalized !== "active" && isUpgradeAttempt) {
    const { error: keepErr } = await sbAdmin
      .from("user_plan")
      .update({
        pending_plan_slug: null,
        updated_at: nowIso,
      })
      .eq("user_id", userId);

    if (keepErr && eventId) {
      await sbAdmin.from("subscriptions_events").update({ processing_error: keepErr.message }).eq("id", eventId);
    }

    return json({
      ok: true,
      event_id: eventId,
      updated: !keepErr,
      kept_current_plan: true,
      user_id: userId,
      plan_slug: existingCurrentSlug,
      attempted_plan_slug: planSlug,
      status: existingStatus || "active",
      mp_topic: topic,
    }, 200);
  }

  if (normalized === "active" && !paidThrough) {
    const existingPaid = safeStr(existingRow?.paid_through);
    paidThrough = existingPaid || plusDaysIso(30);
  }

  const payload = {
    user_id: userId,
    plan_id: planId,
    status: normalized,
    paid_through: normalized === "active" ? paidThrough : (isExistingActive && existingCurrentSlug === planSlug ? existingRow?.paid_through || null : null),
    started_at: normalized === "active"
      ? (isUpgradeAttempt ? nowIso : (existingRow?.started_at || nowIso))
      : existingRow?.started_at || null,
    updated_at: nowIso,
    mp_preapproval_id: normalized === "active" ? effectivePreapprovalId : (isUpgradeAttempt ? existingRow?.mp_preapproval_id || null : effectivePreapprovalId),
    mp_status: mpStatus || null,
    current_plan_slug: normalized === "active"
      ? planSlug
      : (isExistingActive && existingCurrentSlug === planSlug ? planSlug : null),
    pending_plan_slug: normalized === "active" ? null : planSlug,
    cancel_at_period_end: normalized === "canceled",
  };

  const up = await sbAdmin.from("user_plan").upsert(payload, { onConflict: "user_id" });
  if (up.error) {
    if (eventId) {
      await sbAdmin
        .from("subscriptions_events")
        .update({ processing_error: up.error.message, processed_at: nowIso })
        .eq("id", eventId);
    }
    return json({ ok: false, event_id: eventId, updated: false, error: up.error.message }, 500);
  }

  let canceledOld: any = null;
  if (
    normalized === "active" &&
    isUpgradeAttempt &&
    existingRow?.mp_preapproval_id &&
    existingRow.mp_preapproval_id !== effectivePreapprovalId
  ) {
    try {
      canceledOld = await cancelSubscription(existingRow.mp_preapproval_id, MP_ACCESS_TOKEN);
    } catch (e) {
      canceledOld = { ok: false, error: String(e) };
    }
  }

  return json({
    ok: true,
    event_id: eventId,
    updated: true,
    user_id: userId,
    plan_slug: planSlug,
    status: normalized,
    mp_topic: topic,
    canceled_old_subscription: canceledOld,
  });
});
