import { createAdminClient } from "../supabase/admin";

type EmailPayload = {
  to: string[];
  subject: string;
  html: string;
  text: string;
};

type TrackedEmail = EmailPayload & {
  eventKey: string;
  kind: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

function parseRecipients(value: string) {
  return [...new Set(value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export function getAdminNotificationRecipients() {
  return parseRecipients(
    process.env.ADMIN_NOTIFICATION_EMAILS || "maricellourdestomas@gmail.com,maricelconse@gmail.com",
  );
}

function getEmailConfig() {
  return {
    apiKey: required("RESEND_API_KEY"),
    from: process.env.EMAIL_FROM?.trim() || "Maricel Conse <acceso@maricelconse.com.ar>",
  };
}

async function sendEmail(payload: EmailPayload, idempotencyKey: string) {
  const { apiKey, from } = getEmailConfig();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({ from, ...payload }),
  });
  const body = await response.json().catch(() => null) as { id?: string; message?: string } | null;
  if (!response.ok || !body?.id) {
    throw new Error(body?.message || `Resend respondió con estado ${response.status}.`);
  }
  return body.id;
}

export async function sendTrackedEmail(input: TrackedEmail) {
  const admin = createAdminClient();
  const recipients = parseRecipients(input.to.join(","));
  if (recipients.length === 0) throw new Error("La notificación no tiene destinatarios.");

  const payload: EmailPayload = {
    to: recipients,
    subject: input.subject,
    html: input.html,
    text: input.text,
  };
  const { data: deliveryId, error: claimError } = await admin.rpc("claim_notification_delivery", {
    p_event_key: input.eventKey,
    p_kind: input.kind,
    p_recipient: recipients.join(","),
    p_subject: input.subject,
    p_payload: payload,
  });
  if (claimError) throw claimError;
  if (!deliveryId) return { sent: false, skipped: true } as const;

  try {
    const providerMessageId = await sendEmail(payload, input.eventKey);
    const { error } = await admin.from("notification_deliveries").update({
      status: "sent",
      provider_message_id: providerMessageId,
      last_error: null,
      sent_at: new Date().toISOString(),
    }).eq("id", deliveryId);
    if (error) throw error;
    return { sent: true, skipped: false, providerMessageId } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido al enviar el correo.";
    await admin.from("notification_deliveries").update({
      status: "failed",
      last_error: message.slice(0, 1000),
    }).eq("id", deliveryId);
    throw error;
  }
}

export async function retryFailedEmails(limit = 20) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notification_deliveries")
    .select("event_key,kind,payload")
    .eq("status", "failed")
    .lt("attempt_count", 8)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  let sent = 0;
  for (const row of data || []) {
    const payload = row.payload as Partial<EmailPayload> | null;
    if (!payload?.to?.length || !payload.subject || !payload.html || !payload.text) continue;
    try {
      const result = await sendTrackedEmail({
        eventKey: String(row.event_key),
        kind: String(row.kind),
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      if (result.sent) sent += 1;
    } catch (emailError) {
      console.error("No se pudo reintentar una notificación", row.event_key, emailError);
    }
  }
  return sent;
}
