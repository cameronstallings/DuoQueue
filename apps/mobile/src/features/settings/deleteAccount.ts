import { FunctionsHttpError } from "@supabase/supabase-js";

import { appleAuthorizationCodeForDeletion } from "@/features/auth/appleSignIn";
import { hasAppleIdentity } from "@/features/auth/appleIdentity";
import { supabase } from "@/lib/supabase";

/**
 * Deletes the signed-in account through the delete-account Edge Function.
 *
 * Lives outside `useDeleteAccount` so it can be exercised without React: the hook is one line of
 * `useMutation` around this, and every decision worth testing is in here.
 *
 * TWO KINDS OF ACCOUNT, TWO BODIES:
 *
 *   - An email account sends `{}`, exactly as it always has. Nothing about its deletion changes.
 *   - An Apple account first asks Apple for a fresh authorization code and sends it as
 *     `appleAuthorizationCode`, so delete-account can revoke the Sign in with Apple grant even
 *     when the token that should have been stored at sign-in never was. See
 *     `appleAuthorizationCodeForDeletion` for why, and for why a dismissed Apple sheet still
 *     deletes the account.
 *
 * Used by Settings > Account and by "Delete this sign-in" on the post-auth age gate and in the
 * onboarding wizard, which is how an account with no profile, or an unfinished one, gets deleted.
 */
export async function deleteAccountRequest(): Promise<void> {
  const appleAuthorizationCode = await freshAppleCodeIfAppleAccount();

  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("delete-account", {
    body: appleAuthorizationCode ? { appleAuthorizationCode } : {},
  });

  if (error) {
    // A non-2xx answer arrives as a FunctionsHttpError whose own message is the generic "Edge
    // Function returned a non-2xx status code"; the sentence written for the user (a banned
    // account, a legal hold) is in the body and has to be read out of it, the same way
    // useSendMessage reads its locked-conversation body.
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as { error?: unknown } | null;
      if (typeof body?.error === "string" && body.error.length > 0) throw new Error(body.error);
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
}

async function freshAppleCodeIfAppleAccount(): Promise<string | null> {
  let user: Parameters<typeof hasAppleIdentity>[0] = null;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    user = session?.user ?? null;
  } catch (err) {
    // Not knowing is treated as "not Apple": the deletion goes ahead exactly as an email one
    // would, and the server still revokes with any token stored at sign-in.
    console.warn("Could not read the session before deleting the account:", err);
  }

  if (!hasAppleIdentity(user)) return null;
  return await appleAuthorizationCodeForDeletion();
}
