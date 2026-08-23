import { Env } from './env';

export function transformNumber(input: string): string | undefined {
  input = input.replaceAll(/[^0-9]/g, "");
  if (input.startsWith("614") && input.length == 11) {
    return input;
  }
  if (input.startsWith("04") && input.length == 10) {
    return "61" + input.substr(1);
  }
  return undefined;
}

export async function smsOutbound(env: Env, form: FormData, auth: string | null): Promise<Response> {
  if (auth === null || auth !== env.EXPECTED_TWILIOCOMPAT_AUTHENTICATION) {
    console.log("Got unauthenticated SMS outbound request", auth, env.EXPECTED_TWILIOCOMPAT_AUTHENTICATION);
    return new Response("Authentication required", { status: 401 });
  }

  const recipientRaw = form.get("To");
  if (recipientRaw === null || recipientRaw instanceof File) {
    console.log("Got SMS outbound request with no To");
    return new Response("Missing recipient", { status: 400 });
  }
  const body = form.get("Body");
  if (body === null || body instanceof File) {
    console.log("Got SMS outbound request with no Body");
    return new Response("Missing Body parameter", { status: 400 });
  }

  const recipient = transformNumber(recipientRaw);
  if (recipient === undefined) {
    console.log("Refusing to send to non-Australian-mobile number", recipientRaw);
    return new Response("Can't send to that number", { status: 400 })
  }

  const res = await fetch(env.MM_MESSAGE_API, {
    method: "POST",
    headers: {
      'Authorization': env.MM_OUTBOUND_AUTH,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(
      {
        messages: [{
          to: recipient,
          message: body + "{optout}",
          sender: env.MM_SENDER
        }]
      }
    )
  });
  console.log(`Send to ${recipient} got response ${res.status} from MobileMessage API, body: ${await res.text()}`);

  if (res.status == 200)
    return Response.json(
      {
      },
      { status: 200, headers: { "Content-Type": "application/json" }}
    );
  return new Response("Couldn't send message", { status: 500 });
}
