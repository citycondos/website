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

function smsSendResult(html: string): Response {
  return new Response("<html><head><title>SMS send result</title></head><body>" + html + "</body></html>",
                      { headers: { "Content-Type": "text/html" } });
}

interface SendRequiredRecord {
  id: number,
  subject: string,
  "phone.phone_numeric": string
}

interface SendRequiredResponse {
  values: SendRequiredRecord[]
}

interface MMMessage {
  to: string,
  message: string,
  sender: string
}

export async function attemptSms(env: Env): Promise<Response> {
  // Start with a main search...
  const query = {
    select: [ 'subject', 'id', 'phone.phone_numeric' ],
    join: [
      [ 'GroupContact AS group_contact', 'INNER', ['Urgent_Bulk_SMS_Fields.Group_to_Message','=','group_contact.group_id'] ],
      [ 'Contact AS contact', 'INNER', ['group_contact.contact_id','=','contact.id'] ],
      [ 'Phone AS phone', 'INNER', ['contact.phone_primary','=','phone.id'] ]
    ],
    where: [
      [ 'activity_type_id', '=', 57 ],
      [ 'status_id', '=', 1 ],
      [ 'group_contact.status', '=', 'Added' ],
      [ 'contact.do_not_sms', '=', false ],
      [ 'phone.phone', 'IS NOT NULL' ]
    ],
    limit: 25
  };
  const activity_res = await fetch(`${env.CIVICRM_BASE}/ajax/api4/Activity/get`, {
    method: 'POST',
    headers: {
      "X-Civi-Auth": `Bearer ${env.CIVICRM_API_KEY}`,
      "X-Civi-Key": env.CIVICRM_SITE_KEY,
    },
    body: new URLSearchParams({
      'params': JSON.stringify(query),
    })
  });
  
  if (activity_res.status !== 200) {
    return smsSendResult("Failure fetching required sends from CiviCRM. Nothing sent.");
  }

  const target_records = ((await activity_res.json()) as SendRequiredResponse).values;
  if (target_records.length > 300) {
    return smsSendResult(`Not sending because I got back ${target_records.length} to send, which seems like too many. Check activities in CiviCRM are correct.`);
  }

  let log = "";
  const grouped = Object.groupBy(target_records, r => r.id);
  if (target_records.length === 0) {
    log += "Nothing to send. ";
  }
  for (const id in grouped) {
    const recs = grouped[id] as SendRequiredRecord[];
    const send_recs: MMMessage[] = [];
    for (const rec of (recs as SendRequiredRecord[])) {
      const recipient = transformNumber(rec["phone.phone_numeric"]);
      if (recipient !== undefined) {
        send_recs.push({
          to: recipient,
          message: rec.subject + "{optout}",
          sender: env.MM_SENDER
        });
      }
      if (send_recs.length == 0) {
        log += `Skipped sending for activity ${id} because no contacts matched. `;
      } else {
        const send_res = await fetch(env.MM_MESSAGE_API, {
          method: "POST",
          headers: {
            'Authorization': env.MM_OUTBOUND_AUTH,
            'Content-Type': 'application/json',
            'Idempotency-Key': `${id}`
          },
          body: JSON.stringify({ messages: send_recs })
        });
        if (send_res.status === 422) {
          log += `MobileMessage has already processed activity ${id}. `;
        } else if (send_res.status === 200) {
          log += `Queued ${send_recs.length} messages for activity ${id}. `;
        } else {
          log += `Got unexpected status ${send_res.status} from MobileMessage for activity ${id}. `;
          console.log("MM response body", await send_res.text());
        }
      }

      // Now we mark the activity as done...
      const save_res = await fetch(`${env.CIVICRM_BASE}/ajax/api4/Activity/update`, {
        method: 'POST',
        headers: {
          "X-Civi-Auth": `Bearer ${env.CIVICRM_API_KEY}`,
          "X-Civi-Key": env.CIVICRM_SITE_KEY,
        },
        body: new URLSearchParams({
          'params': JSON.stringify({
            values: {
              status_id: 2
            },
            where:  [["id","=", id]]
          }),
        })
      });
      if (save_res.status !== 200) {
        log += `Could not mark activity ${id} as Completed in CiviCRM. Refresh with 24h or manually update to avoid duplicate send. `;
      }
    }
  }
  
  return smsSendResult(log);
}
