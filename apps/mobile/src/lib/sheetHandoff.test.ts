import { describe, expect, it } from "vitest";

import { createSheetHandoff } from "./sheetHandoff";

function recorder() {
  const calls: string[] = [];
  return {
    calls,
    close: () => calls.push("close"),
    open: (name: string) => () => calls.push(`open ${name}`),
  };
}

describe("createSheetHandoff on iOS (waits for the slide-out)", () => {
  it("closes the sheet at once but opens the next modal only when the sheet reports dismissed", () => {
    const handoff = createSheetHandoff(true);
    const r = recorder();

    handoff.handOff(r.close, r.open("report"));
    expect(r.calls).toEqual(["close"]);

    handoff.onDismissed();
    expect(r.calls).toEqual(["close", "open report"]);
  });

  it("opens it exactly once, however many dismissals follow", () => {
    const handoff = createSheetHandoff(true);
    const r = recorder();

    handoff.handOff(r.close, r.open("report"));
    handoff.onDismissed();
    handoff.onDismissed();
    expect(r.calls).toEqual(["close", "open report"]);
  });

  it("does nothing when the sheet was closed without picking a row (scrim tap)", () => {
    const handoff = createSheetHandoff(true);
    const r = recorder();

    handoff.onDismissed();
    expect(r.calls).toEqual([]);
  });

  it("lets the last row tapped during the slide-out win, since only one modal can open", () => {
    const handoff = createSheetHandoff(true);
    const r = recorder();

    handoff.handOff(r.close, r.open("report"));
    handoff.handOff(r.close, r.open("schedule"));
    handoff.onDismissed();
    expect(r.calls).toEqual(["close", "close", "open schedule"]);
  });

  it("still opens the next modal if the dismissal is reported during the close itself", () => {
    const handoff = createSheetHandoff(true);
    const calls: string[] = [];

    handoff.handOff(
      () => {
        calls.push("close");
        handoff.onDismissed();
      },
      () => calls.push("open report"),
    );
    expect(calls).toEqual(["close", "open report"]);
  });
});

describe("createSheetHandoff on Android (no onDismiss, dialogs stack)", () => {
  it("closes the sheet and opens the next modal in the same step, as before", () => {
    const handoff = createSheetHandoff(false);
    const r = recorder();

    handoff.handOff(r.close, r.open("report"));
    expect(r.calls).toEqual(["close", "open report"]);
  });

  it("parks nothing, so a stray dismissal cannot open it a second time", () => {
    const handoff = createSheetHandoff(false);
    const r = recorder();

    handoff.handOff(r.close, r.open("report"));
    handoff.onDismissed();
    expect(r.calls).toEqual(["close", "open report"]);
  });
});
