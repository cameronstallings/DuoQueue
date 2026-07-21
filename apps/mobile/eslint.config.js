const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: ["dist/*", ".expo/*"],
  },
  {
    // Reanimated shared values are intentionally mutable UI-thread refs (`.value = x`
    // inside gesture worklets), which is exactly the pattern react-hooks' newer
    // React-Compiler-oriented rules are designed to flag for plain React state. That
    // conflict is a known, accepted tradeoff of using Reanimated — see
    // https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/glossary/#shared-value
    files: [
      "src/features/swipe/**/*.tsx",
      "src/features/swipe/**/*.ts",
      "src/components/Skeleton.tsx",
      "app/match/**/*.tsx",
    ],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
