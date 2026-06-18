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
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#FF6B00"
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
        backgroundColor: "#150000"
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
      [
        "onesignal-expo-plugin",
        {
          "mode": IS_DEV ? "development" : "production"
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
      oneSignalAppId: "2f15e79a-b878-4ac7-a918-9d6d8bc28d60",
      eas: {
        projectId: "5d45f797-09e9-4b48-b05a-879326f60839",
        build: {
          experimental: {
            ios: {
              appExtensions: [
                {
                  targetName: "OneSignalNotificationServiceExtension",
                  // Dynamically update iOS extensions to match the dev bundle
                  bundleIdentifier: IS_DEV 
                    ? "com.gafi.app.dev.OneSignalNotificationServiceExtension" 
                    : "com.gafi.app.OneSignalNotificationServiceExtension",
                  entitlements: {
                    "com.apple.security.application-groups": [
                      IS_DEV 
                        ? "group.com.gafi.app.dev.onesignal" 
                        : "group.com.gafi.app.onesignal"
                    ]
                  }
                }
              ]
            }
          }
        }
      }
    },
    sdkVersion: "54.0.0"
  }
};