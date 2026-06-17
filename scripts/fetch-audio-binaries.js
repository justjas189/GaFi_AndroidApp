#!/usr/bin/env node
/**
 * fetch-audio-binaries.js — Windows-safe replacement for react-native-audio-api's
 * POSIX-only `download-prebuilt-binaries.sh`.
 *
 * Why this exists: react-native-audio-api ships ONLY C++ headers. Its compiled
 * native libs are pulled at build time by a Gradle Exec task that runs
 * `bash ... curl ... unzip`. On Windows the Gradle daemon can't spawn those
 * tools, so the download silently no-ops and CMake/Ninja fail with
 * `libopusfile.a ... missing`. node_modules gets wiped on every `npm install`,
 * so we re-fetch here from `postinstall` — pure Node + platform-native unzip,
 * no bash dependency.
 *
 * Pulls only the 2 Android-relevant archives (skips the 3 iOS ones the upstream
 * script also downloads). Self-skips when the binaries are already present.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const TAG = 'v3.1.0';
const BASE = `https://github.com/software-mansion-labs/rn-audio-libs/releases/download/${TAG}`;

// Resolve the package no matter how npm hoisted it.
let PKG_ROOT;
try {
  PKG_ROOT = path.dirname(require.resolve('react-native-audio-api/package.json'));
} catch {
  console.log('[audio-bins] react-native-audio-api not installed — nothing to do.');
  process.exit(0);
}

// android.zip  -> <pkg>/common/cpp/audioapi/external/  (yields external/android/<abi>/*.a)
// jniLibs.zip  -> <pkg>/android/src/main/              (yields jniLibs/<abi>/*.so)
const EXTERNAL_DIR = path.join(PKG_ROOT, 'common', 'cpp', 'audioapi', 'external');
const JNILIBS_DEST = path.join(PKG_ROOT, 'android', 'src', 'main');

// Guard: if the static libs already linked at last build are here, bail fast.
const GUARD = path.join(EXTERNAL_DIR, 'android', 'arm64-v8a', 'libopusfile.a');
if (fs.existsSync(GUARD)) {
  console.log('[audio-bins] prebuilt binaries already present — skipping.');
  process.exit(0);
}

async function download(name, destFile) {
  const url = `${BASE}/${name}`;
  console.log(`[audio-bins] downloading ${name} ...`);
  // global fetch (Node 18+) follows GitHub's 302 redirect to the asset CDN.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destFile, buf);
  console.log(`[audio-bins]   -> ${buf.length} bytes`);
}

function unzip(zipFile, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (process.platform === 'win32') {
    // PowerShell ships on Win10+; Expand-Archive needs no extra tooling.
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -LiteralPath '${zipFile}' -DestinationPath '${destDir}' -Force`,
      ],
      { stdio: 'inherit' }
    );
  } else {
    execFileSync('unzip', ['-o', zipFile, '-d', destDir], { stdio: 'inherit' });
  }
}

// rm -rf the macOS cruft the archives carry.
function stripMacCruft(dir) {
  for (const junk of ['__MACOSX']) {
    fs.rmSync(path.join(dir, junk), { recursive: true, force: true });
  }
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-audio-bins-'));
  try {
    const androidZip = path.join(tmp, 'android.zip');
    const jniZip = path.join(tmp, 'jniLibs.zip');

    await download('android.zip', androidZip);
    await download('jniLibs.zip', jniZip);

    unzip(androidZip, EXTERNAL_DIR);
    unzip(jniZip, JNILIBS_DEST);

    stripMacCruft(EXTERNAL_DIR);
    stripMacCruft(JNILIBS_DEST);

    if (!fs.existsSync(GUARD)) {
      throw new Error(`extraction finished but ${GUARD} is still missing`);
    }
    console.log('[audio-bins] done — static libs + ffmpeg jniLibs in place.');
  } catch (err) {
    console.error(`[audio-bins] FAILED: ${err.message}`);
    console.error('[audio-bins] fetch manually from ' + BASE);
    process.exit(1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})();
