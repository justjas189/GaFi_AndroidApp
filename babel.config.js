module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo', 'nativewind/babel'],
    plugins: [
      ["module:react-native-dotenv", {
        "moduleName": "@env",
        "path": ".env",
        "blacklist": null,
        "whitelist": null,
        "safe": false,
        "allowUndefined": true
      }],
      // Reanimated 4 moved the worklets Babel plugin into the separate
      // react-native-worklets package. Reference it directly (the reanimated
      // plugin is just a re-export) and keep it LAST in the plugins list.
      'react-native-worklets/plugin'
    ],
  };
}; 