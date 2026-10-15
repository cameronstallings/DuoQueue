import { create } from "zustand";

import { hapticError } from "@/lib/haptics";

export type ToastStatus = "success" | "error" | "info";

interface ToastState {
  message: string | null;
  /** Defaults to "success" — every existing call site omits this and keeps
   *  rendering exactly as before. */
  status: ToastStatus;
  showToast: (message: string, status?: ToastStatus) => void;
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  status: "success",
  showToast: (message, status = "success") => {
    if (hideTimer) clearTimeout(hideTimer);
    // The haptic map: an error toast buzzes, here and only here, so no screen has to remember it
    // and none fires it twice. Never call hapticError() right before showToast(..., "error").
    if (status === "error") hapticError();
    set({ message, status });
    hideTimer = setTimeout(() => set({ message: null }), 2000);
  },
}));
