import { Env } from './env';

export async function verifyMmSignature<A>(
  env: Env,
  xMmTimestamp: string | null,
  xMmSignature: string | null,
  rawBody: ArrayBuffer,
  wrappedFn: (env: Env, body: A) => Promise<Response>): Promise<Response> {
  if (!xMmTimestamp || !xMmSignature) {
    return new Response("Missing signature headers", { status: 400 });
  }

  const timestamp = Number(xMmTimestamp);

  if (!Number.isInteger(timestamp)) {
    return new Response("Bad timestamp header", { status: 400 });
  }

  if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
    return new Response("Timestamp out of range", { status: 400 });
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.MM_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const prefix = new TextEncoder().encode(`${xMmTimestamp}.`);
  const message = new Uint8Array(prefix.byteLength + rawBody.byteLength);
  message.set(prefix);
  message.set(new Uint8Array(rawBody), prefix.byteLength);

  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, message),
  );

  // Make hex string...
  const expectedSignature = Array.from(signature, byte =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  if (!timingSafeEqual(expectedSignature, xMmSignature)) {
    return new Response("Unauthorized wrong secret", { status: 401 });
  }

  let body: A;

  try {
    body = JSON.parse(new TextDecoder().decode(rawBody)) as A;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  return wrappedFn(env, body);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
