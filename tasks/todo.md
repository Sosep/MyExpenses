# Tasks: Containerized signed APK build — V1

Plan: `tasks/plan.md`
Spec: `SPEC-docker-build.md`

- [x] **T1 — Repo housekeeping**
  - Acceptance: `.secrets/` is ignored by git; `.dockerignore` excludes `.git`, build outputs, Gradle
    caches, `local.properties`, `.secrets`, IDE files, specs/tasks.
  - Verify: `git check-ignore .secrets/release.jks`; `docker build` context does not include them.
  - Files: `.gitignore`, `.dockerignore`

- [x] **T2 — Dockerfile with JDK 21 and Android SDK**
  - Acceptance: image builds on `linux/amd64`; contains Temurin 21, cmdline-tools, platform
    `android-37.0`, build-tools 36/37, platform-tools, licenses accepted; builder user UID/GID 1000;
    `/gradle-cache` writable; `ANDROID_HOME`/`GRADLE_USER_HOME` set; scripts on PATH.
  - Verify: `docker compose build`; `docker run --rm image bash -lc 'java -version; sdkmanager
    --list_installed | grep ...'`
  - Files: `Dockerfile`

- [x] **T3 — One-time keystore setup**
  - Acceptance: `keystore-init` creates `.secrets/keystore.env` (600) and `.secrets/release.jks`
    (PKCS12, RSA 4096, alias `myexpenses`); refuses to overwrite an existing `.jks`; reuses an
    existing password file if only the `.jks` is missing.
  - Verify: `mkdir -p .secrets && docker compose --profile setup run --rm keystore-init`; run twice,
    second fails; `keytool -list -keystore .secrets/release.jks`.
  - Files: `docker/keystore-init.sh`, `compose.yaml`

- [x] **T4 — Release/debug build service and signing**
  - Acceptance: default run invokes Gradle with `--no-daemon --build-cache --max-workers=2` (serial
    across modules), adds `--parallel` only when `GRADLE_PARALLEL=1`, applies the compose memory
    limit (12g default; measured peak ~8g), builds `:myExpenses:packageExternReleaseUniversalApk`, selects exactly
    one unsigned `*universal*.apk` (fails if zero or several; never a split APK), zipaligns, signs
    with the keystore, verifies, and prints the signed APK path under
    `myExpenses/build/outputs/apk_from_bundle/externRelease/`; `BUILD_VARIANT=debug` builds
    `:myExpenses:assembleExternDebug` without the release keystore; extra args run the given Gradle
    task; missing secrets fail with the `keystore-init` instruction.
  - Verify: `docker compose run --rm android-build`; `BUILD_VARIANT=debug docker compose run --rm
    android-build`; `apksigner verify --verbose <signed.apk>`.
  - Files: `docker/entrypoint.sh`, `compose.yaml`

- [x] **T5 — End-to-end verification**
  - Acceptance: cold build and warm build succeed; signed release APK is valid and has package
    `org.totschnig.myexpenses`; debug works; missing-secret failure is clear; no root-owned files;
    no SDK reinstall on the warm run; report the signed APK size and confirm it is minified/shrunk;
    measured serial default: first uncached build ~7.9 GB peak (8 GB too tight), clean rebuild with
    cache ~30 s / ~1.5 GB, incremental rebuild ~20 s, APK ~36 MB.
  - Verify: `apksigner verify --verbose`; `aapt2 dump badging <apk> | head`; `find . -user root -not
    -path './.git/*'`; `docker compose run --rm android-build` twice.
  - Files: none (manual checks)

- [x] **T6 — README "Build with Docker"**
  - Acceptance: README documents Docker/Compose, x86_64/ARM, RAM/disk/network, `mkdir -p .secrets`,
    one-time keystore init, backup warning, release and debug commands, output paths, install note,
    that the same keystore is required for updates, the serial default, how to opt into parallel with
    `GRADLE_PARALLEL=1`, `GRADLE_MAX_WORKERS`, `BUILD_MEMORY`, the measured memory/time figures, that
    the universal APK is assembled/signed serially at the end, and that the release build produces one
    universal APK containing the dynamic feature modules (no separate module APKs to install), with
    the size trade-off versus a device-specific Play install.
  - Verify: follow the section from a clean shell; every command works as written.
  - Files: `README.md`

- [x] **T7 — Final audit and commit**
  - Acceptance: no secrets tracked or baked into the image; `.dockerignore` effective; no app source
    or Gradle changes; branch contains spec, plan, tasks and tooling; final commit created.
  - Verify: `git status`; `git diff --check`; `docker history <image>` (no secrets); `git log -1`.
  - Files: `SPEC-docker-build.md`, `tasks/plan.md`, `tasks/todo.md` (commit)
