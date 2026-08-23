import { Env } from './env';

export type SmsInboundBody = {
  to: string;
  sender: string;
  message: string;
  received_at: string;
  type: "inbound" | "unsubscribe";
  original_message_id: string;
  original_custom_ref: string;
};

type PhoneContactRecord = {
  contact_id: number
};
type PhoneContacts = {
  values: PhoneContactRecord[]
};

export async function smsInbound(env: Env, body: SmsInboundBody): Promise<Response> {
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
      const contact_resp = await res.json() as PhoneContacts;
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
