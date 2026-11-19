# Spec: Containerized APK build (Dockerfile + Compose) — V1

Status: approved (2026-11-16)
Branch: `feature/docker-build` (based on `master`)

## Objective

Provide a reproducible, containerized way to build a **production (release) APK** without installing
Java 21 and the Android SDK on the host. A developer runs one command and gets a **signed, installable
release APK**, with Gradle/SDK caches reused between runs. The same command accepts a `debug` variant
when a debug build is explicitly wanted.

A release APK cannot be installed unsigned. Signing is therefore part of the build: the container
signs the release APK with a **self-signed release keystore** that lives outside the repository and
outside the image. The target is personal sideloading on the user's devices, not Play Store
publishing.

## Decisions from review

- Production/release is the default; debug is opt-in, never the default.
- The user can choose the variant at run time (`BUILD_VARIANT=release|debug`).
- Self-signed keystore generated once by a setup command.
- Keystore location: `./.secrets/release.jks`, documented in the README.
- Passwords: generated automatically, stored in `./.secrets/keystore.env` (gitignored, chmod 600);
  the user does not have to invent them.
- Output: the signed APK stays under the Gradle build tree
  (`myExpenses/build/outputs/apk_from_bundle/externRelease/`), no separate `dist/`.
- Base image: official `eclipse-temurin:21-jdk` + Android command-line tools.
- Image name: `myexpenses-android-build:latest`.
- Deliverables: `Dockerfile`, `compose.yaml`, and a "Build with Docker" section in `README.md`.
- Build concurrency: serial across modules by default; `--parallel` is opt-in via `GRADLE_PARALLEL=1`
  and always capped by `GRADLE_MAX_WORKERS`.
- Resource guard: the compose service has a configurable `mem_limit` (`BUILD_MEMORY`, default 12g;
  a measured full release build peaked at about 8g, so 8g was too tight).
- Documentation: the README is the main, plain-language guide; technical decisions stay in this
  spec.

## Assumptions

1. Docker Engine/Compose v2+ is available (host: Linux `x86_64`, UID/GID 1001).
2. The container user is driven by `HOST_UID`/`HOST_GID`. They must match the
   user that owns the repository checkout, or every gradle run fails at
   `build.gradle:76` (git "dubious ownership") and cannot write
   `/gradle-cache`. The repo-root `.env` (gitignored, copied from
   `.env.example`) holds this host's values, so documented commands work
   without exporting anything; `.env` is read by compose automatically.
2. Java 21 is required (README); Gradle is pinned by the wrapper (9.9.0), AGP is 9.5.1 and
   `compileSdk`/`targetSdk` are 37/36. The stable SDK platform package is `platforms;android-37.0`
   (minor API version); `build-tools;37.0.0` exists.
3. No NDK/CMake is needed: no `externalNativeBuild` is configured.
4. The README release task is `:myExpenses:packageExternReleaseUniversalApk`; it produces an
   **unsigned** universal APK because `signingConfig` is commented out. The container zipaligns and
   signs it with the self-signed release keystore.
5. The app is for personal installation. Losing the keystore means future updates cannot be installed
   over the current app; the keystore and password file must be backed up together.
6. The build needs network access (Gradle, Google Maven, JitPack, Sonatype). The default container
   limit is 12 GB of memory (configurable; an 8 GB limit was measured to kill the release build at
   R8) and image + caches need roughly 10–15 GB of disk.
7. No API key is required for a release build.

## Tech stack

- `eclipse-temurin:21-jdk-noble` (pinned tag) as base.
- Android `cmdline-tools;latest`, `platform-tools`, `platforms;android-37.0`,
  `build-tools;36.0.0` and `build-tools;37.0.0` (AGP default safety), licenses accepted at image
  build time.
- `zipalign` and `apksigner` from build-tools 37 for release signing.
- Docker Compose for the repo bind mount, UID/GID mapping, Gradle cache and secret mount.

## Commands

One-time keystore creation (generates `.secrets/release.jks` and `.secrets/keystore.env`):

```
docker compose --profile setup run --rm keystore-init
```

One-time host alignment (skip when `.env` already matches this host's ids;
no image rebuild needed — the entrypoint realigns ownership on each run):

```
printf 'HOST_UID=%s\nHOST_GID=%s\n' "$(id -u)" "$(id -g)" > .env
```

Build the signed production APK (default):

```
docker compose run --rm android-build
```

Choose the debug variant explicitly:

```
BUILD_VARIANT=debug docker compose run --rm android-build
```

Escape hatch for any Gradle task:

```
docker compose run --rm android-build :myExpenses:testExternDebugUnitTest
```

Standalone alternative without Compose:

```
docker build -t myexpenses-android-build .
docker run --rm -v "$PWD:/workspace" -v "$PWD/.secrets:/secrets:ro" \
  -e BUILD_VARIANT=release -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  myexpenses-android-build
```

## Project structure

```
Dockerfile                  -> JDK 21 + Android SDK toolchain; non-root at runtime
                               (root entrypoint aligns ownership, then setpriv drop)
compose.yaml                -> android-build service + keystore-init setup profile
docker/entrypoint.sh        -> resolves BUILD_VARIANT, builds, zipaligns and signs release
docker/keystore-init.sh     -> generates password file and self-signed keystore once
.dockerignore               -> excludes .git, build/, .gradle/, local.properties, .secrets/
.gitignore                  -> adds .secrets/ and the Docker Gradle cache directory
.env / .env.example         -> HOST_UID/HOST_GID for this host (.env gitignored)
README.md                   -> new "Build with Docker" section
.secrets/release.jks        -> generated; never committed
.secrets/keystore.env       -> generated password + alias; never committed
```

No app sources or Gradle build files are changed.

## Behaviour

Gradle always runs with `--no-daemon --build-cache --max-workers="${GRADLE_MAX_WORKERS:-2}"`.
`--parallel` is added only when `GRADLE_PARALLEL=1`. The final universal packaging and signing are
serial.

The entrypoints start as root only to align ownership; nothing user-facing runs as root. The image is built with fixed `USER_ID`/`GROUP_ID`
build args (default 1000), so a container running under a different uid/gid (compose passes `HOST_UID`
and `HOST_GID`) would otherwise find `HOME=/home/builder` and `/gradle-cache` unwritable — Robolectric
fails with "Couldn't create lock file /home/builder/.robolectric-download-lock" and Gradle cannot use the
cache. `docker/docker-user.sh`, sourced by both `entrypoint.sh` and `keystore-init.sh`, starts as root,
aligns the ownership of `/home/builder` and `/gradle-cache` with `HOST_UID`/`HOST_GID` (only when they
differ, to keep runs cheap), and then drops privileges with `setpriv` before Gradle or keytool run, so no
user-facing process and no generated file are root-owned. A non-root start (plain `docker run --user …`)
falls back to a writable `/tmp` HOME.

`BUILD_VARIANT=release` (default):

1. `./gradlew :myExpenses:packageExternReleaseUniversalApk --no-daemon ...`
2. locate the unsigned universal APK in `myExpenses/build/outputs/apk_from_bundle/externRelease/`
3. `zipalign -p -f 4 unsigned.apk aligned.apk`
4. `apksigner sign --ks /secrets/release.jks --ks-key-alias "$KEY_ALIAS"` with
   `--ks-pass env:KEYSTORE_PASSWORD --key-pass env:KEYSTORE_PASSWORD`, writing
   `myExpenses/build/outputs/apk_from_bundle/externRelease/myExpenses-extern-release-universal-signed.apk`
5. `apksigner verify --verbose` and fail if verification fails or the keystore/password file is
   missing, with a message pointing to the `keystore-init` command.

`BUILD_VARIANT=debug`:

1. `./gradlew :myExpenses:assembleExternDebug --no-daemon`
2. print the debug APK path; no release signing involved.

Both variants print the final APK path at the end.

`keystore-init`:

1. if `.secrets/keystore.env` does not exist, generate a strong random password and write
   `KEYSTORE_PASSWORD=...` and `KEY_ALIAS=myexpenses` with `chmod 600`;
2. run `keytool -genkeypair -storetype PKCS12 -keystore /secrets/release.jks -alias myexpenses
   -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=MyExpenses, O=Personal"`;
3. refuse to overwrite an existing keystore, to protect future updates.

## Code style

Dockerfile: one concern per layer, pinned versions, clean `apt` lists, no secrets, non-root at
runtime. Compose: explicit service name, quoted `${HOST_UID:-1000}`/`${HOST_GID:-1000}` defaults, named Gradle cache volume,
read-only secrets mount. Shell: `set -euo pipefail`, quoted variables.

```dockerfile
ARG ANDROID_CMDLINE_TOOLS_VERSION=13114758
ARG ANDROID_PLATFORM=android-37
ARG ANDROID_BUILD_TOOLS=37.0.0
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH
```

## Testing strategy

Verified manually on the current host:

1. Cold path: `docker compose build`, `keystore-init`, `docker compose run --rm android-build` exits
   0 and a signed APK exists under `myExpenses/build/outputs/apk_from_bundle/externRelease/`.
2. `apksigner verify --verbose` passes; `aapt2 dump badging` reports
   `org.totschnig.myexpenses` with no `.debug` suffix.
3. Warm path: a second run reuses the Gradle cache and does not reinstall the SDK.
4. `BUILD_VARIANT=debug` produces the debug APK and does not require the release keystore.
5. Missing/wrong keystore or password fails with an actionable message, not a half-signed artifact.
6. Re-running `keystore-init` does not overwrite an existing keystore.
7. No root-owned files in the repo; no keystore/password in the image or compose file.
8. `.dockerignore` keeps `.git`, `build/`, `.gradle/`, `local.properties` and `.secrets/` out of the
   build context.
9. Wall-clock time and peak container memory are measured for the serial default; the figures are
   documented. Measured on 12 CPU cores / 30 GB RAM: first uncached build peaked at ~7.9 GB (8 GB
   was too tight); clean rebuild with cache took ~30 s and ~1.5 GB; incremental rebuild ~20 s; APK
   ~36 MB.

No automated Docker test suite in V1; the image build and the commands above are the checks.

## Boundaries

- Always: pin JDK/SDK/build-tools tags; accept SDK licenses inside the image; use `--no-daemon`;
  zipalign before signing, never after; verify the signature; keep caches and secrets outside the
  image; document ARM/emulation and backup of `.secrets/`.
- Ask first: editing `myExpenses/build.gradle` (e.g. to pin `buildToolsVersion` or add a Gradle
  signingConfig), adding a CI workflow, publishing the image, building an AAB for Play.
- Never: bake keystores or passwords into the image/compose/docs; commit `.secrets/` or `.env`;
  modify app sources to make the container work; build release as debug.

## Success criteria

- From a clean checkout plus a generated keystore, `docker compose run --rm android-build` produces a
  **signed, installable release APK** under `myExpenses/build/outputs/apk_from_bundle/externRelease/` with no
  host Java/Android SDK.
- `apksigner verify` passes and the package id is `org.totschnig.myexpenses` (no `.debug` suffix).
- `BUILD_VARIANT=debug` is available as an explicit opt-in.
- Rebuilding reuses the Gradle cache; the SDK is not reinstalled.
- Generated files in the bind-mounted repo are owned by the host user.
- Missing secrets fail with a clear message; no secrets or keystores enter the image or git.
- The README documents prerequisites, keystore creation/location/backup, both variants, output paths,
  disk/RAM needs, the ARM/emulation caveat, the serial default and how to opt into parallel builds,
  in plain language with a small troubleshooting table.
- The measured build time and peak memory are recorded in the README.

## Out of scope (deferred)

- Publishing to Google Play (AAB, upload key, Play Console).
- Release signing through the Gradle `signingConfig` instead of post-signing (ask first).
- GitHub Actions or other CI integration, including CI secret storage.
- Emulator/instrumented tests and screenshot tests.
- Publishing the builder image to a registry.
- Multi-arch images and native/NDK builds.
- Reproducible byte-identical builds and pre-warmed images.

## Resolved questions

1. Self-signed keystore, generated once.
2. Location `./.secrets/release.jks`, documented in the README.
3. Passwords are generated automatically and stored in `.secrets/keystore.env`; the user backs up the
   whole `.secrets/` directory.
4. The signed APK stays under the Gradle `build/` output tree; no `dist/`.
5. Personal installation on the user's device; Play Store publishing is out of scope.
6. The keystore password is generated automatically; the user does not choose it.
