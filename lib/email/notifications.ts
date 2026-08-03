import { MEMBERSHIP_AMOUNT_ARS, getAppOrigin } from "../mercadopago/config";
import { createAdminClient } from "../supabase/admin";
import { getAdminNotificationRecipients, sendTrackedEmail } from "./resend";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha informada";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(date);
}

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function emailShell(title: string, body: string, ctaLabel: string, ctaUrl: string) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#eef4ed;color:#173934;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #cfe0d9;border-radius:20px"><tr><td style="padding:32px"><p style="margin:0 0 22px;color:#2f8f7d;font-size:12px;font-weight:800;letter-spacing:2px">MARICEL <em style="font-family:Georgia,serif;font-size:17px;font-weight:400">Conse</em></p><h1 style="margin:0 0 18px;color:#1f554d;font-family:Georgia,serif;font-size:34px;line-height:1.08">${title}</h1>${body}<p style="margin:26px 0 6px"><a href="${ctaUrl}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#1f554d;color:#fff;font-size:12px;font-weight:800;letter-spacing:.8px;text-decoration:none;text-transform:uppercase">${ctaLabel}&nbsp;→</a></p></td></tr></table></td></tr></table></body></html>`;
}

export async function notifySubscriptionActivated(input: {
  profileId: string;
  providerSubscriptionId: string;
  payerEmail: string;
  accessUntil: string;
}) {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("display_name,email")
    .eq("id", input.profileId)
    .single();
  if (error) throw error;

  const memberEmail = String(profile.email || input.payerEmail).trim().toLowerCase();
  const name = String(profile.display_name || "Nueva pasajera").trim();
  const periodKey = new Date(input.accessUntil).toISOString().slice(0, 10);
  const origin = getAppOrigin();
  const adminBody = `<p style="font-size:16px;line-height:1.65">Se confirmó un pago mensual y la alumna ya tiene acceso a la plataforma.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="8" style="margin:18px 0;background:#f3f7f2;border-radius:12px"><tr><td><strong>Pasajera</strong></td><td>${escapeHtml(name)}</td></tr><tr><td><strong>Email</strong></td><td>${escapeHtml(memberEmail)}</td></tr><tr><td><strong>Importe</strong></td><td>${escapeHtml(money(MEMBERSHIP_AMOUNT_ARS))}</td></tr><tr><td><strong>Acceso hasta</strong></td><td>${escapeHtml(formatDate(input.accessUntil))}</td></tr></table>`;
  const memberBody = `<p style="font-size:16px;line-height:1.65">Tu pago fue confirmado y tu lugar en la membresía ya está activo.</p><p style="font-size:16px;line-height:1.65">Vas a poder ingresar a las clases, recursos y ebooks hasta el <strong>${escapeHtml(formatDate(input.accessUntil))}</strong>. La membresía se renovará mensualmente mientras permanezca activa.</p>`;

  await Promise.allSettled([
    sendTrackedEmail({
      eventKey: `subscription-approved-admin/${input.providerSubscriptionId}/${periodKey}`,
      kind: "subscription_approved_admin",
      to: getAdminNotificationRecipients(),
      subject: `Nueva suscripción confirmada · ${name || memberEmail}`,
      html: emailShell("Nueva pasajera a bordo.", adminBody, "Ver suscripciones", `${origin}/admin`),
      text: `Nueva suscripción confirmada\nPasajera: ${name}\nEmail: ${memberEmail}\nImporte: ${money(MEMBERSHIP_AMOUNT_ARS)}\nAcceso hasta: ${formatDate(input.accessUntil)}\n\n${origin}/admin`,
    }),
    sendTrackedEmail({
      eventKey: `subscription-approved-member/${input.providerSubscriptionId}/${periodKey}`,
      kind: "subscription_approved_member",
      to: [memberEmail],
      subject: "¡Bienvenida a bordo! Tu membresía está activa",
      html: emailShell("¡Tu membresía está activa!", memberBody, "Ingresar a mi espacio", `${origin}/mi-espacio`),
      text: `¡Tu membresía está activa!\n\nTu pago fue confirmado. Tenes acceso hasta el ${formatDate(input.accessUntil)}.\n\nIngresa a tu espacio: ${origin}/mi-espacio`,
    }),
  ]).then((results) => {
    for (const result of results) if (result.status === "rejected") console.error("No se pudo enviar una notificación de alta", result.reason);
  });
}

export async function notifySubscriptionPaymentIssue(input: {
  providerSubscriptionId: string;
  payerEmail: string;
  paymentStatus: string;
  reference: string;
}) {
  const origin = getAppOrigin();
  const body = `<p style="font-size:16px;line-height:1.65">Mercado Pago informó que un cobro de la membresía no quedó aprobado. No se habilitó acceso por este movimiento.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="8" style="margin:18px 0;background:#fff3ef;border-radius:12px"><tr><td><strong>Email</strong></td><td>${escapeHtml(input.payerEmail)}</td></tr><tr><td><strong>Estado</strong></td><td>${escapeHtml(input.paymentStatus)}</td></tr></table>`;
  await sendTrackedEmail({
    eventKey: `subscription-issue-admin/${input.providerSubscriptionId}/${input.reference}/${input.paymentStatus}`,
    kind: "subscription_payment_issue_admin",
    to: getAdminNotificationRecipients(),
    subject: `Atención: cobro de membresía ${input.paymentStatus}`,
    html: emailShell("Un cobro necesita revisión.", body, "Revisar suscripciones", `${origin}/admin`),
    text: `Un cobro de membresía necesita revisión.\nEmail: ${input.payerEmail}\nEstado: ${input.paymentStatus}\n\n${origin}/admin`,
  });
}

export async function notifyLeadCompleted(input: {
  profileId: string;
  displayName: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  country: string;
  journeyArrival: string;
  membershipGoal: string;
}) {
  const origin = getAppOrigin();
  const name = input.displayName || input.email;
  const location = [input.city, input.province, input.country].filter(Boolean).join(", ");
  const body = `<p style="font-size:16px;line-height:1.65">Una alumna completó su perfil y dejó nuevas respuestas para acompañar su proceso.</p><p><strong>${escapeHtml(name)}</strong><br>${escapeHtml(input.email)}${input.phone ? `<br>${escapeHtml(input.phone)}` : ""}${location ? `<br>${escapeHtml(location)}` : ""}</p><div style="margin:18px 0;padding:18px;background:#f3f7f2;border-radius:12px"><p style="margin:0 0 8px"><strong>¿Cómo llegas a este viaje?</strong></p><p style="margin:0;line-height:1.6">${escapeHtml(input.journeyArrival)}</p></div><div style="margin:18px 0;padding:18px;background:#f3f7f2;border-radius:12px"><p style="margin:0 0 8px"><strong>¿Qué te gustaría lograr con esta membresía?</strong></p><p style="margin:0;line-height:1.6">${escapeHtml(input.membershipGoal)}</p></div>`;
  await sendTrackedEmail({
    eventKey: `lead-completed-admin/${input.profileId}`,
    kind: "lead_completed_admin",
    to: getAdminNotificationRecipients(),
    subject: `Nuevo perfil completado · ${name}`,
    html: emailShell("Una nueva historia para acompañar.", body, "Ver leads", `${origin}/admin`),
    text: `Nuevo perfil completado\n${name}\n${input.email}\n${input.phone}\n${location}\n\n¿Cómo llegas a este viaje?\n${input.journeyArrival}\n\n¿Qué te gustaría lograr?\n${input.membershipGoal}\n\n${origin}/admin`,
  });
}
