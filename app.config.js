const IS_DEV = process.env.APP_VARIANT === 'development';

export default {
  expo: {
    name: IS_DEV ? "GaFi (Dev)" : "GaFi",
    slug: "gafi-android",
    owner: "gafi_dev_build",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/GaFi_Icon_1024x1024.png",
    userInterfaceStyle: "automatic",
    scheme: "gafi",
    splash: {
      // NOTE: This block only applies when `expo prebuild` regenerates native
      // files. This is a bare workflow with a committed android/ dir (no prebuild),
      // so the LIVE Android splash is driven by the native files, NOT this config:
      //   android/app/src/main/res/values/colors.xml  -> @color/splashscreen_background
      //   android/app/src/main/res/drawable-*/splashscreen_logo.png
      // These values are kept in sync with those native files.
      image: "./assets/GaFi_Logo_Mark.png",
      resizeMode: "contain",
      backgroundColor: "#1C1C1C"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEV ? "com.gafi.app.dev" : "com.gafi.app"
    },
    android: {
      adaptiveIcon: {
        // Transparent, safe-zone-padded GF mark (see assets/GaFi_Adaptive_Foreground.png).
        // Background is the icon's dark maroon — orange mark would vanish on #FF6B00.
        // Matches the committed native @color/ic_launcher_background (#150000).
        foregroundImage: "./assets/GaFi_Adaptive_Foreground.png",
        backgroundColor: "#330606"
      },
      package: IS_DEV ? "com.gafi.app.dev" : "com.gafi.app",
      googleServicesFile: "./google-services.json",
      permissions: [
        "NOTIFICATIONS",
        "SCHEDULE_EXACT_ALARM"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      [
        "expo-notifications",
        {
          // Android status-bar icon must be white-on-transparent; Android tints it
          // with `color`. A full-color icon would render as a solid white square.
          "icon": "./assets/GaFi_Notification_Icon.png",
          "color": "#FF6B00"
        }
      ],
      "@react-native-community/datetimepicker",
      "expo-audio",
      "react-native-audio-api",
      "expo-font",
      [
        "@react-native-google-signin/google-signin",
        {
          // Android reads client config from ./google-services.json (set above).
          // iOS needs the reversed iOS OAuth client id. Pull from env so no
          // secret is hard-coded; placeholder keeps Android-only builds valid.
          "iosUrlScheme":
            process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ||
            "com.googleusercontent.apps.placeholder"
        }
      ]
    ],
    extra: {
      // Surfaced to the JS runtime via Constants.expoConfig.extra.appVariant.
      // process.env.APP_VARIANT is only readable here at config-eval time (Node);
      // it is NOT inlined into the app bundle unless prefixed EXPO_PUBLIC_, so the
      // production guard for Test tooling reads it from `extra`, not process.env.
      appVariant: IS_DEV ? "development" : "production",
      eas: {
        projectId: "5d45f797-09e9-4b48-b05a-879326f60839"
      }
    },
    sdkVersion: "54.0.0"
  }
};