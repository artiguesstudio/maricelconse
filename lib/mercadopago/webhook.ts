function parseSignature(value: string) {
  return Object.fromEntries(
    value.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function validateMercadoPagoSignature(input: {
  dataId: string;
  requestId: string;
  signature: string;
  secret: string;
}) {
  const { ts, v1 } = parseSignature(input.signature);
  if (!ts || !v1) return false;

  const normalizedId = /[a-z]/i.test(input.dataId)
    ? input.dataId.toLowerCase()
    : input.dataId;
  const manifest = [
    normalizedId ? `id:${normalizedId};` : "",
    input.requestId ? `request-id:${input.requestId};` : "",
    ts ? `ts:${ts};` : "",
  ].join("");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(input.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
  return timingSafeEqual(toHex(signature), v1.toLowerCase());
}

export function addOneMonth(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDay));
  return date.toISOString();
}
