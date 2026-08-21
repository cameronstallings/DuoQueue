// ---------------------------------------------------------------------------
// The welcome email, in one place.
//
// This module exists because the same message has to be sendable from two
// runtimes. The Edge Function `waitlist-signup` sends it inline at signup; the
// local `scripts/waitlist.mjs send-deferred` sends it to rows the endpoint
// stored but could not mail — because the 80/day budget was spent, or because
// RESEND_SEND_API_KEY was not set yet. Two copies of an email body drift, and a
// launch blast whose "first contact" never matched the welcome it claims to
// follow is worse than no welcome at all. So there is one copy, here.
//
// It has no Deno-specific and no Node-specific import, deliberately. Deno reads
// it as TypeScript directly; Node strips the types on import. Do not add an
// import to this file that only one of the two can resolve.
//
// It is not a courtesy. It does three jobs the launch blast depends on:
//   1. It proves the address. A typo or a harvested address bounces NOW, days
//      before the one email that matters, and the blast can then skip it.
//   2. It stops the launch email being a cold first contact from a name the
//      recipient last saw on a nine second video.
//   3. It carries the opt-out, so unsubscribing is not first offered on launch
//      day.
//
// Styled as the campaign's end card, because that is the frame the recipient
// just came from: warm off-white ground, near-black type, and chartreuse
// appearing only inside a dark slab. Chartreuse on a light ground measures
// 1.05:1 and would be invisible. System font stacks, since mail clients do not
// load webfonts and a missing face here would silently reset the whole design.
// ---------------------------------------------------------------------------

export const SITE_ORIGIN = "https://duoqueue.io";
export const FROM_ADDRESS = "DuoQueue <support@duoqueue.io>";
export const SUPPORT_EMAIL = "support@duoqueue.io";
export const POSTAL_ADDRESS = "DuoQueue, 201 N Becket St, Cary, NC 27513, USA";

/** The 80/day cap on welcome sends. It is not about Resend's 3,000/month; it is
 * about the 100/day ceiling, which this shares with Supabase Auth's account
 * confirmation email because Resend is wired as its custom SMTP provider. 80
 * leaves 20/day for auth. A signup is NEVER lost to protect that headroom — over
 * budget still writes the row and only skips the email. Both senders import this
 * constant so the local script cannot spend the headroom the endpoint protects. */
export const WELCOME_BUDGET_PER_DAY = 80;

/** The exact headers the endpoint sends with the welcome. List-Unsubscribe is set
 * even on the transactional API so a mailbox provider has a one-click opt-out to
 * point at from the very first message. */
export const WELCOME_HEADERS: Record<string, string> = {
  "List-Unsubscribe": `<mailto:${SUPPORT_EMAIL}?subject=unsubscribe>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
};

export const WELCOME_SUBJECT = "You are on the DuoQueue list";

export const WELCOME_TEXT = `You are on the list.

You will get one more email from us, the day DuoQueue goes live on the App Store. That is it.

DuoQueue is an 18+ app for finding people to play games with. Not dating. You match on games, schedules and playstyle, then you talk and queue up.

Everyone on this list gets the app on the same day on purpose. A matching app is only worth opening if there is somebody on the other side, so we are starting everyone at once.

If you did not sign up for this, reply and say so and we will remove you.

${POSTAL_ADDRESS}
`;

export function welcomeHtml(): string {
  const sans =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const mono = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${WELCOME_SUBJECT}</title></head>
<body style="margin:0;padding:0;background:#F6F3EA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F3EA;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="font-family:${mono};font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#5C6450;padding-bottom:28px;">The waitlist</td></tr>
  <tr><td style="font-family:${sans};font-size:32px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:#161A0F;padding-bottom:20px;">You are on the list.</td></tr>
  <tr><td style="font-family:${sans};font-size:16px;line-height:1.6;color:#161A0F;padding-bottom:16px;">You will get one more email from us, the day DuoQueue goes live on the App Store. That is it.</td></tr>
  <tr><td style="font-family:${sans};font-size:16px;line-height:1.6;color:#161A0F;padding-bottom:16px;">DuoQueue is an 18+ app for finding people to play games with. Not dating. You match on games, schedules and playstyle, then you talk and queue up.</td></tr>
  <tr><td style="padding:12px 0 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:#0A0B09;padding:18px 26px;font-family:${sans};font-size:18px;line-height:1.3;font-weight:800;letter-spacing:-0.02em;color:#CDFF3D;">everyone starts on the same day</td>
    </tr></table>
  </td></tr>
  <tr><td style="font-family:${sans};font-size:16px;line-height:1.6;color:#161A0F;padding-bottom:28px;">A matching app is only worth opening if there is somebody on the other side, so we are starting everyone at once.</td></tr>
  <tr><td style="border-top:1px solid #DDD8C8;padding-top:20px;font-family:${sans};font-size:13px;line-height:1.6;color:#5C6450;">
    If you did not sign up for this, reply to this email and say so and we will remove you.<br><br>
    ${POSTAL_ADDRESS}<br>
    <a href="${SITE_ORIGIN}/privacy/" style="color:#4A6B00;">Privacy Policy</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
