# Walkthrough: Android Debug APK Build

## Steps Executed

| Step                  | Command                     | Result                                  |
| --------------------- | --------------------------- | --------------------------------------- |
| 1. Rebuild web assets | `npm run build`             | ✅ `dist/` updated (Vite v7.3.1, 9.56s) |
| 2. Sync to Android    | `npx cap sync android`      | ✅ Assets copied in 0.505s              |
| 3. Build debug APK    | `gradlew.bat assembleDebug` | ✅ BUILD SUCCESSFUL                     |

## Output

**APK Location:**

```
clients\android\app\build\outputs\apk\debug\app-debug.apk
```

**Size:** ~4.45 MB
**Built at:** 2026-03-20 1:46 PM

## How to Install

1. Transfer `app-debug.apk` to your Android device
2. Enable **"Install from unknown sources"** in device settings
3. Tap the APK file to install

> [!NOTE]
> This is a **debug APK** (unsigned). For Play Store distribution, a release build with signing keys would be needed.

## Future Rebuilds

Remove the `android` directory before rebuilding to ensure a clean build:

```powershell
$env:ANDROID_HOME = "C:\Users\Bimsara\AppData\Local\Android\Sdk"
npx cap add android
npm run build
npx cap sync android
cd android; .\gradlew.bat assembleDebug
```
