import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToastStore } from "./toast-store";

/**
 * The error haptic lives here, centrally, so no screen has to remember it and no screen fires it
 * twice: an error toast buzzes once, every other toast is silent. The haptics module is mocked by
 * its literal specifier (vitest hoists the mock above the import).
 */
const mocks = vi.hoisted(() => ({ errors: 0 }));

vi.mock("@/lib/haptics", () => ({
  hapticError: () => {
    mocks.errors += 1;
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  mocks.errors = 0;
  useToastStore.setState({ message: null, status: "success" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("showToast", () => {
  it("an error toast fires the error haptic exactly once", () => {
    useToastStore.getState().showToast("Couldn't save. Try again.", "error");
    expect(mocks.errors).toBe(1);
    expect(useToastStore.getState()).toMatchObject({ message: "Couldn't save. Try again.", status: "error" });
  });

  it.each([undefined, "success", "info"] as const)("a %s toast is silent", (status) => {
    useToastStore.getState().showToast("Saved", status);
    expect(mocks.errors).toBe(0);
  });

  it("defaults to success, as every existing call site expects", () => {
    useToastStore.getState().showToast("Saved");
    expect(useToastStore.getState().status).toBe("success");
  });

  it("clears the message after two seconds, and a newer toast restarts the clock", () => {
    useToastStore.getState().showToast("First");
    vi.advanceTimersByTime(1500);
    useToastStore.getState().showToast("Second");
    vi.advanceTimersByTime(1500);
    expect(useToastStore.getState().message).toBe("Second");
    vi.advanceTimersByTime(500);
    expect(useToastStore.getState().message).toBeNull();
  });
});
