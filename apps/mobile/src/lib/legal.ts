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

// DuoQueue's App Store listing. The https link is the same one the site uses
// (APP_STORE_URL in scripts/build-site.mjs); the itms-apps link opens the App Store app directly,
// with the https one as its fallback (the "Update DuoQueue" screen).
export const APP_STORE_ID = "6798837181";
export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;
export const APP_STORE_DEEP_LINK = `itms-apps://apps.apple.com/app/id${APP_STORE_ID}`;

// Riot Games' Developer Policies boilerplate, WORD FOR WORD: the comma after the second "Riot
// Games" is part of Riot's text, not a typo, so do not "fix" it. Shown in Settings > Legal
// (AboutFooter). The site footer (RIOT_NOTICE in scripts/build-site.mjs) and the App Store
// description carry the same line and must change together with this one; legal.test.ts checks
// the site's copy.
export const RIOT_NOTICE =
  "DuoQueue isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games " +
  "or anyone officially involved in producing or managing Riot Games properties. Riot Games, and " +
  "all associated properties are trademarks or registered trademarks of Riot Games, Inc.";
