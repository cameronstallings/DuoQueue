// duoqueue.io is the real domain (bought on Namecheap, already serving mail through
// Resend), so these are the RIGHT addresses — but nothing is hosted at them yet, so
// today every one of these links 404s.
//
// TODO(Cameron) — REQUIRED BEFORE SUBMISSION. App Review clicks these. A privacy policy
// link that 404s is a guaranteed rejection under Guideline 5.1.1, and Guideline 1.2
// separately requires published contact information for any app carrying user content:
//   1. Publish docs/legal/privacy-policy.md and docs/legal/terms-of-service.md as public
//      pages at the two URLs below. GitHub Pages is free and enough; it needs a CNAME
//      record at Namecheap, in the same DNS panel as the existing Resend records.
//   2. Point supportEmail at a real, monitored inbox on the domain.
//   3. Paste the Privacy Policy URL into App Store Connect > App Information, and the
//      support address into the Support URL / contact fields.
//
// Every in-app link (Settings, sign-up, paywall) reads from here, so once those pages
// exist there is nothing further to change in the app.
export const LEGAL_URLS = {
  privacyPolicy: "https://duoqueue.io/privacy",
  termsOfService: "https://duoqueue.io/terms",
  supportEmail: "support@duoqueue.io",
} as const;
