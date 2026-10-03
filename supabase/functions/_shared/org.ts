/**
 * The one place DuoQueue's real-world contact details are written down.
 *
 * =====================================================================================
 * WHY THIS FILE EXISTS
 * =====================================================================================
 *
 * The postal address was written out five separate times: once in the welcome email's
 * footer, twice as a "Mailing address" line in the two legal documents, once inside the
 * arbitration opt-out sentence, and once beside the DMCA agent. Changing it meant finding
 * all five, and missing one meant a published legal page disagreeing with the email that
 * links to it about where the company can be served.
 *
 * That is not hypothetical maintenance worry. The address is Cameron's home, it is already
 * public on two live pages at duoqueue.io, and replacing it with a PO Box or a commercial
 * mailbox is a thing that is going to happen. This turns that from five edits into one.
 *
 * =====================================================================================
 * IT LIVES UNDER supabase/functions/_shared/ AND THAT IS DELIBERATE
 * =====================================================================================
 *
 * `supabase functions deploy` bundles what it can reach from the entrypoint, and it does
 * not reach outside supabase/functions/. So the Edge Function has to be able to import
 * this directly, which pins it here. scripts/build-site.mjs reads it the other way, by
 * parsing the literal out of this file, and fails the build if it cannot find it.
 *
 * The direction matters: the runtime that SENDS email owns the value, and the build that
 * publishes pages borrows it. A site build that cannot read this file stops rather than
 * publishing a page with a stale address on it.
 *
 * =====================================================================================
 * WHAT THE LAW ACTUALLY WANTS, SO THE NEXT EDIT DOES NOT DELETE IT
 * =====================================================================================
 *
 * CAN-SPAM requires a valid physical postal address in commercial email. The waitlist
 * welcome announces a forthcoming product and the launch email plainly promotes one, so
 * both carry it, and removing it is not an option. The FTC does accept a PO Box or a
 * registered commercial mailbox as "valid", which is the fix here rather than deletion.
 *
 * One thing this file cannot do for you: the DMCA designated agent is REGISTERED with the
 * U.S. Copyright Office, and that filing is a separate record. Changing the address here
 * updates the Terms page; it does not update the Directory, and an agent whose registered
 * address is wrong can cost the safe harbour that section exists to claim.
 */

/** The street address alone, with no company name in front of it.
 *
 * Bare on purpose: the two legal documents print it after their own "Mailing address:"
 * label, while the email footer and the arbitration clause want "DuoQueue, " in front. One
 * value composed two ways beats two values that can drift apart. */
export const POSTAL_ADDRESS = "808 Crawford St, Houston, TX 77010, USA";

/** The same address as an email footer or a legal notice wants it: who, then where. */
export const POSTAL_ADDRESS_WITH_NAME = `DuoQueue, ${POSTAL_ADDRESS}`;

/** The monitored address behind support, safety reports and privacy rights requests. It is
 * the same one throughout the app; see apps/mobile/src/lib/legal.ts. */
export const SUPPORT_EMAIL = "support@duoqueue.io";
