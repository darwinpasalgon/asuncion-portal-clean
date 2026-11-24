#!/usr/bin/env bash
set -euo pipefail

task_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
task_sdk="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
: "${task_sdk:?Set ANDROID_SDK_ROOT to the Android SDK directory}"
: "${ANHS_ANDROID_KEYSTORE:?Set ANHS_ANDROID_KEYSTORE to the original release PKCS12 file}"
: "${ANHS_ANDROID_PASSWORD_FILE:?Set ANHS_ANDROID_PASSWORD_FILE to its one-line password file}"
task_tools="$task_sdk/build-tools/36.0.0"
task_version="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["appVersionName"])' "$task_root/twa-manifest.json")"
task_output="$task_root/app/build/outputs/apk/release/ANHS-Academic-Portal-v$task_version.apk"
task_aligned="$task_root/app/build/outputs/apk/release/app-release-aligned.apk"

cd -- "$task_root"
./gradlew --no-daemon --max-workers=2 :app:assembleRelease :app:lintRelease
"$task_tools/zipalign" -P 16 -f 4 "$task_root/app/build/outputs/apk/release/app-release-unsigned.apk" "$task_aligned"
"$task_tools/apksigner" sign --ks "$ANHS_ANDROID_KEYSTORE" --ks-type PKCS12 --ks-key-alias anhs-portal --ks-pass "file:$ANHS_ANDROID_PASSWORD_FILE" --out "$task_output" "$task_aligned"
"$task_tools/apksigner" verify --verbose --print-certs "$task_output"
"$task_tools/zipalign" -c -P 16 4 "$task_output"
"$task_tools/aapt2" dump badging "$task_output"
sha256sum "$task_output"
