module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-worklets/plugin"],
    env: {
      production: {
        // Strip console.* from release builds — several call sites log Supabase error
        // messages, which can carry identifiers we don't want sitting in device logs.
        // Dev/preview builds keep them for debugging.
        plugins: ["transform-remove-console"],
      },
    },
  };
};
