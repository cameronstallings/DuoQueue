// All three are live. The two pages are built from docs/legal/*.md by scripts/build-site.mjs
// and served over HTTPS from GitHub Pages at the duoqueue.io apex; support@ is a real,
// monitored NEO mailbox on the domain. App Review clicks these links, and a 404 here would
// be a Guideline 5.1.1 rejection, so if you ever change the site's structure, change it here
// in the same commit — every in-app link (Settings, sign-up, paywall) reads from this file.
export const LEGAL_URLS = {
  privacyPolicy: "https://duoqueue.io/privacy",
  termsOfService: "https://duoqueue.io/terms",
  supportEmail: "support@duoqueue.io",
} as const;
