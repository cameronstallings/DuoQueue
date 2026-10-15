import { useEffect, useState } from "react";
import { Redirect } from "expo-router";

import { COMMIT_COPY } from "@/features/auth/frontDoorCopy";
import { CompleteSignupScreen } from "@/features/auth/CompleteSignupScreen";
import { getPendingConfirmationEmail } from "@/features/auth/pendingConfirmation";
import { useSessionRoute } from "@/features/auth/useSessionRoute";
import { CommitDraftScreen } from "@/features/onboarding/CommitDraftScreen";
import { draftCleanupOnApp } from "@/features/onboarding/commitDraft";
import { wizardResumePath } from "@/features/onboarding/steps";
import { useCommitStore } from "@/store/commit-store";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";

/**
 * "/": where every guard sends anybody whose place it cannot name itself, and the one screen that
 * RENDERS the in-between states instead of redirecting to them.
 *
 * RENDERED, NOT REDIRECTED: the post-auth age gate (CompleteSignupScreen) and, since 1.0.2, the
 * commit of a signup draft (CommitDraftScreen). Both are states that every layout guard sends to
 * "/", so the screen has to live at the end of that arrow rather than behind another one: a
 * screen inside (auth) or (onboarding) would be redirected away the instant the route changed,
 * and this index would send it straight back. A closed loop with no frame in between.
 *
 * THE COMMIT'S PHASE COMES BEFORE THE ROUTE. While "Save your card" is being written, the route
 * itself moves underneath it ("commit-draft", then "app" the moment the card is finished), so the
 * commit screen stays up for as long as the commit is running, failed, or saying "Welcome", and
 * the destination it chose (/welcome or /invited) is taken when it is done.
 *
 * A LEFT-OVER DRAFT AT "app" IS DISCARDED here: a returning player who signed in from the front
 * door or from Save, or a kill between the card's submit and the draft's discard. "app" always
 * means a finished card (sessionRouting.ts), so nothing in the draft can still be needed.
 */
export default function Index() {
  const status = useSessionStore((s) => s.status);
  const route = useSessionRoute();
  const phase = useCommitStore((s) => s.phase);
  const destination = useCommitStore((s) => s.destination);
  const hasAgeConfirmed = useOnboardingStore((s) => s.ageConfirmedDob !== null);
  const commitPending = useOnboardingStore((s) => s.commitPending);
  const lastStep = useOnboardingStore((s) => s.lastStep);
  const hasDraft = hasAgeConfirmed || commitPending;
  // `undefined` = still reading storage; `null` = read, nothing pending.
  const [pendingEmail, setPendingEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (status !== "signed_out") {
      setPendingEmail(null);
      return;
    }
    let cancelled = false;
    void getPendingConfirmationEmail().then((email) => {
      if (!cancelled) setPendingEmail(email);
    });
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (route !== "app" || phase !== "idle" || !hasDraft) return;
    const cleanup = draftCleanupOnApp({ hasDraft, commitPending });
    if (cleanup.discard) useOnboardingStore.getState().discardDraft();
    if (cleanup.toast) useToastStore.getState().showToast(COMMIT_COPY.welcomeBack, "info");
  }, [route, phase, hasDraft, commitPending]);

  // The destination has been taken once this screen is replaced by it.
  useEffect(
    () => () => {
      if (useCommitStore.getState().phase === "done") useCommitStore.getState().consume();
    },
    [],
  );

  if (status === "signed_in" && (phase === "running" || phase === "error" || phase === "welcome")) {
    return <CommitDraftScreen />;
  }
  if (status === "signed_in" && phase === "done") return <Redirect href={destination ?? "/(tabs)"} />;

  // A profile read that has not landed (or that failed), or a draft not yet read back from the
  // phone, is not an answer, and every guess is somebody's wrong screen. The store retries a
  // failed read on a timer, and the draft has a 2 s fallback, so this resolves itself.
  if (route === "hold") return null;

  if (route === "start" || route === "draft") {
    // Hold a frame rather than flashing the front door before redirecting straight past it.
    if (pendingEmail === undefined) return null;
    // Someone who signed up, left to fetch the code, and came back belongs on the code
    // screen — not back at the front door, hunting for the way in again. (Dormant while email
    // confirmation is off; kept so turning it back on needs no client change.)
    if (pendingEmail) {
      return <Redirect href={{ pathname: "/(auth)/confirm-email", params: { email: pendingEmail } }} />;
    }
    // A card in progress picks up where it was left; nobody else has a draft to resume.
    if (route === "draft") return <Redirect href={wizardResumePath(lastStep, false)} />;
    return <Redirect href="/(auth)/start" />;
  }

  if (route === "complete-signup") return <CompleteSignupScreen />;
  if (route === "commit-draft") return <CommitDraftScreen />;

  if (route === "onboarding") return <Redirect href={wizardResumePath(lastStep, true)} />;
  return <Redirect href="/(tabs)" />;
}
