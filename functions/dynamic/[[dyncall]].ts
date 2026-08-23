import { Env } from './env';
import { verifyMmSignature } from './mobilemsgsign';
import { smsInbound } from './smsinbound';
import { smsOutbound } from './smsoutbound';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const [_secret, dyncallType, ...others] = context.params.dyncall;
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
    case "smsoutbound":
      return smsOutbound(context.env, await context.request.formData(), context.request.headers.get("Authorization"));
    default:
      return Response.json({err: "Unknown webhook", input: dyncallType}, { status: 404 });
  }
};
