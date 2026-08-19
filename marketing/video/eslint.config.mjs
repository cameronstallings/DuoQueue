import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // out/ is renders, public/ is supplied or synced binaries, state/ is a JSON ledger.
    // None of them are source.
    ignores: ["out/**", "public/**", "state/**", "eslint.config.mjs"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // This project renders in Chromium, and the app it markets was approved by Apple with a
      // hoisted node_modules that Metro resolves from. Pulling a react-native web shim in here
      // to reuse a component would land in that same flat tree. See Spec correction 1 in
      // docs/superpowers/plans/2026-08-18-remotion-pipeline.md.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react-native",
                "react-native/*",
                "react-native-svg",
                "@expo/vector-icons",
                "expo-*",
              ],
              message:
                "The video project renders in Chromium. See Spec correction 1 in the plan.",
            },
            {
              // A regex, not a { group } with "!" negations: group patterns are matched with
              // gitignore semantics, which refuse to re-include a path once a parent directory
              // is excluded, so ["@app/*", "!@app/theme/tokens"] restricts tokens.ts anyway.
              // Verified against eslint 9 + the ignore package on 2026-08-18.
              regex: "^@app/(?!theme/tokens$)(?!theme/logo-geometry$)",
              message:
                "Only tokens.ts and logo-geometry.ts may be imported from the app.",
            },
          ],
        },
      ],
    },
  },
);
