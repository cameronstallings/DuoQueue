// TODO(Cameron): duoqueue.com is a placeholder domain — nothing is hosted there yet.
// Before submitting to App Store review:
//   1. Publish docs/legal/privacy-policy.md and docs/legal/terms-of-service.md as real,
//      public web pages (GitHub Pages is free and sufficient for this repo).
//   2. Replace the two URLs below with the real hosted addresses.
//   3. Replace supportEmail with a real, monitored inbox.
//   4. Paste the same Privacy Policy URL into App Store Connect's App Information tab,
//      and the support email/URL into the Support URL / contact fields there too.
// Every in-app link below (Settings, sign-up, paywall) reads from this one place, so
// fixing it here is the only change needed once the pages are live.
export const LEGAL_URLS = {
  privacyPolicy: "https://duoqueue.com/privacy-policy",
  termsOfService: "https://duoqueue.com/terms-of-service",
  supportEmail: "support@duoqueue.com",
} as const;
