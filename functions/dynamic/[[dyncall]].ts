type SmsInboundBody = {
  to: string;
  sender: string;
  message: string;
  received_at: string;
  type: "inbound" | "unsubscribe";
  original_message_id: string;
  original_custom_ref: string;
};

type Env = {
  MM_WEBHOOK_SECRET: string,
  CIVICRM_BASE: string,
  CIVICRM_API_KEY: string,
  CIVICRM_SITE_KEY: string,
};

type PhoneContactRecord = {
  contact_id: number
};
type PhoneContacts = {
  values: PhoneContactRecord[]
};

async function verifyMmSignature<A>(
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

async function smsInbound(env: Env, body: SmsInboundBody): Promise<Response> {
  if (body.type === "unsubscribe") {
    if (body.sender.startsWith("614")) {
      const contactPhone = "0" + body.sender.substr(2);
      const res = await fetch(`${env.CIVICRM_BASE}/ajax/api4/Phone/get`, {
        method: 'POST',
        headers: {
          "X-Civi-Auth": `Bearer ${env.CIVICRM_API_KEY}`,
          "X-Civi-Key": env.CIVICRM_SITE_KEY,
        },
        body: new URLSearchParams({
          'params': JSON.stringify(
            {
              "select":["contact_id"],
              "where":[["is_primary","=",true],["phone_numeric","=",contactPhone],
                       ["contact_id.do_not_sms","=",false],["contact_id.is_deleted","=",false]],
              "limit":25
            }
          ),
        })
      });
      if (res.status != 200) {
        return new Response(`Unexpected CiviCRM status ${res.status}`, { status: 500 });
      }
      const contact_resp = await res.json();
      const contacts = contact_resp.values.map(v => v.contact_id);
      
      const resUpd = await fetch(`${env.CIVICRM_BASE}/ajax/api4/Contact/update`, {
        method: 'POST',
        headers: {
          "X-Civi-Auth": `Bearer ${env.CIVICRM_API_KEY}`,
          "X-Civi-Key": env.CIVICRM_SITE_KEY,
        },
        body: new URLSearchParams({
          'params': JSON.stringify(
            {"values":{"do_not_sms":true},"where":[["id","IN", contacts]]}
          ),
        })
      });
      if (resUpd.status != 200) {
        return new Response(`Unexpected CiviCRM update status ${res.status}`, { status: 500 });
      }
    }
  }
  return Response.json({"result": "processed"});
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const [_secret, dyncallType] = context.params.dyncall;
  const rawBody = await context.request.clone().arrayBuffer();  
  switch (dyncallType) {
    case "smsinbound":
      return verifyMmSignature(
        context.env,
        context.request.headers.get("X-MM-Timestamp"),
        context.request.headers.get("X-MM-Signature"),
        rawBody,
        smsInbound
      );
    default:
      return Response.json({err: "Unknown webhook", input: dyncallType}, { status: 404 });
  }
};
