# ANHS Academic Portal for Android

Version **2.0.0**, version code **2**. Package: `ph.edu.asuncionnhs.portal`.

The app opens the live [ANHS portal](https://asuncion-nhs.vercel.app/) as a Trusted Web Activity. ILAW planning, ARAL support, and the refreshed learning interface are provided by the website. Internet access and a compatible browser are required. The native opening screen and system colors match the refreshed portal.

The v2 APK retains the original v1 release certificate and package. It is intended to install over v1 as an update. Android 6.0 (API 23) or later is required; compile and target SDK are API 36.

## Build

Install JDK 21, Android SDK platform 36, and Android SDK build tools 36.0.0. Set `JAVA_HOME` and `ANDROID_SDK_ROOT`.

From this directory, build an unsigned release and run lint:

```sh
./gradlew --no-daemon --max-workers=2 :app:assembleRelease :app:lintRelease
```

To sign, set `ANHS_ANDROID_KEYSTORE` to the original release PKCS12 file and `ANHS_ANDROID_PASSWORD_FILE` to its one-line password file, then run `./build-release.sh`. Keep these files outside this checkout. The signing alias is `anhs-portal`. The signing script uses the keystore password for its private key and does not print the password.

The repository includes the Gradle wrapper and pins the Gradle distribution checksum. Release keys and password files are excluded.

## Release checks

[verification.json](releases/verification.json) records the APK hash, version, certificate match, live website association, ZIP alignment, and lint result. Android lint completed with zero errors and eight warnings inherited from the generated v1 project (tool update advice, data-extraction configuration advice, and unused generated resources).

An actual Android phone test remains outstanding. Before school-wide distribution:

1. Install the APK over v1 on a test phone, without uninstalling the existing app.
2. Confirm the app opens the portal and existing sign-in/password-change flows work.
3. Use a teacher account to save and export an ILAW lesson plan.
4. Assign an ARAL support plan through the administrator view; check the tutor view and the assigned student's activity/help-request view.
5. Confirm downloads, print/share handling, keyboard layout, back navigation, and the mobile navigation bar.

APK files in this directory are signed release builds prepared for that pilot. The web portal is already live.
