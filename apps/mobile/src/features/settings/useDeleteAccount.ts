import { useMutation } from "@tanstack/react-query";

import { deleteAccountRequest } from "./deleteAccount";

export function useDeleteAccount() {
  return useMutation({
    mutationFn: deleteAccountRequest,
  });
}
