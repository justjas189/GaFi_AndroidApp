const IS_DEV = process.env.APP_VARIANT === 'development';

export default {
  expo: {
    name: IS_DEV ? "GaFi (Dev)" : "GaFi",
    slug: "gafi-android",
    owner: "gafi_dev_build",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
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
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FF6B00"
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
          "icon": "./assets/icon.png",
          "color": "#FF6B00"
        }
      ],
      [
        "onesignal-expo-plugin",
        {
          "mode": "development"
        }
      ],
      "@react-native-community/datetimepicker",
      "expo-audio"
    ],
    extra: {
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