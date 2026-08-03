import { create } from "zustand";

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
    set({ message, status });
    hideTimer = setTimeout(() => set({ message: null }), 2000);
  },
}));
