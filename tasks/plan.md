# Plan: Containerized signed APK build — V1

Spec: `SPEC-docker-build.md` (approved 2026-11-16)
Branch: `feature/docker-build` (based on `master`)
App changes: none.

## Goal

Build a signed, installable **release** APK inside a container, with debug available on request.
The keystore and its generated password stay in `./.secrets/` on the host. Output stays in the
Gradle build tree. README documents the workflow.

## Components and dependencies

| Component | Responsibility | Depends on |
|---|---|---|
| `.gitignore` / `.dockerignore` | keep secrets and build output out of git and the Docker context | — |
| `Dockerfile` | JDK 21, Android cmdline-tools, platform `android-37.0`, build-tools 36/37, licenses, non-root builder | — |
| `docker/keystore-init.sh` | generate password env file + self-signed PKCS12 keystore once | Dockerfile |
| `docker/entrypoint.sh` | choose variant, run Gradle, locate APK, zipalign, sign, verify | Dockerfile, keystore |
| `compose.yaml` | repo bind mount, UID/GID, Gradle cache volume, read-only secrets, setup profile | Dockerfile, scripts |
| `README.md` section | prerequisites, keystore, commands, output, backup, ARM caveat | working compose |

## Implementation order

1. **Housekeeping** — add `.secrets/` to `.gitignore`; create `.dockerignore` excluding `.git`,
   `build`, `.gradle`, `local.properties`, `.secrets`, `.idea`, docs/specs and task files.
2. **Dockerfile** — Temurin 21 (pin the resolved tag/digest), install tools, create builder user
   UID/GID 1000, install SDK components, accept licenses, create `/gradle-cache`, copy scripts,
   set `ANDROID_HOME`/`GRADLE_USER_HOME`, entrypoint.
3. **Keystore init** — script + compose `setup` profile; generate random password with
   `openssl rand`, write `keystore.env` with `umask 077`, refuse to overwrite an existing `.jks`,
   reuse an existing env file if the `.jks` is missing, verify with `keytool -list`.
4. **Build service** — `docker/entrypoint.sh` and `android-build` service.
   Default is **serial across modules** and low-concurrency: `--no-daemon --build-cache
   --max-workers="${GRADLE_MAX_WORKERS:-2}"`. `--parallel` is added only when
   `GRADLE_PARALLEL=1` is set, still capped by `GRADLE_MAX_WORKERS`. Final universal packaging and
   signing are always serial:
   - `BUILD_VARIANT=release` (default): `:myExpenses:packageExternReleaseUniversalApk`, select the
     unsigned file matching `*universal*.apk` (fail if zero or several; never sign a split APK),
     `zipalign -p -f 4`, `apksigner sign`, `apksigner verify`, print path.
   - `BUILD_VARIANT=debug`: `:myExpenses:assembleExternDebug`, print path, no release keystore.
   - extra arguments: run them through `./gradlew --no-daemon` unchanged.
   - missing/invalid secrets: fail before building with the `keystore-init` command in the message.
5. **Verification** — cold and warm builds, signature/package checks, ownership, failure paths.
6. **README** — "Build with Docker" section: requirements (x86_64, ~6 GB RAM, 10–15 GB disk,
   network), `mkdir -p .secrets`, one-time keystore init, backup warning, release and debug commands,
   output paths, install note, ARM/emulation caveat, `GRADLE_PARALLEL`/`GRADLE_MAX_WORKERS`/
   `BUILD_MEMORY`, and the note that the release task produces one universal APK including the
   dynamic feature modules (no separate module APKs to install). Explain that the default is serial
   and low-memory, that parallel is opt-in with a worker cap, that the universal APK is
   assembled/signed serially at the end, and the size trade-off: universal includes all
   features/ABIs/languages; a Play AAB would deliver a device-specific install, which is out of scope.
7. **Final audit** — no secrets tracked or in the image, `.dockerignore` effective, `git diff --check`,
   working tree clean after the final commit.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| AGP 9.5.1 expects a build-tools version different from 37.0.0 | install both 36.0.0 and 37.0.0; only pin `buildToolsVersion` in Gradle if required (ask first) |
| SDK license/download failures | pinned cmdline-tools, `yes | sdkmanager --licenses`, install components in one layer |
| Named Gradle cache volume owned by root | create `/gradle-cache` in the image owned by UID 1000; run as `${UID:-1000}:${GID:-1000}`; document other UIDs |
| Root-owned files in the repo | non-root user, `HOME=/tmp`, UID/GID from compose; verify with `find . -user root` |
| Universal APK task name/path differs in AGP 9 | check `./gradlew :myExpenses:tasks`; locate output with `find .../extern/release -name '*.apk'`; fall back to `assembleExternRelease` only if needed |
| Release build fails under R8/minify | verify the task first; do not change ProGuard/build files without approval |
| Signing the wrong artifact or signing twice | exclude `*-signed.apk` when locating the unsigned APK; verify after signing; never zipalign after signing |
| Password in image/history | passwords only in `.secrets/keystore.env` mounted at runtime; never `COPY` `.secrets`; `.dockerignore` |
| ARM hosts | document `linux/amd64` requirement and emulation slowness |
| First build time/disk | Gradle cache volume; document first-run duration and disk use |
| Parallel workers exceed container memory (`-Xmx4g`) | parallel off by default; `GRADLE_PARALLEL=1` opts in; `GRADLE_MAX_WORKERS` default 2/4; measure peak memory before documenting a higher value |
| Container consumes too much host memory | `mem_limit: ${BUILD_MEMORY:-12g}` (configurable) in compose; measured release peak ~8g, so 8g killed R8; raise explicitly rather than letting it grow unbounded |

## Verification checkpoints

1. `docker compose build` succeeds; the image reports JDK 21 and installed SDK components.
2. `mkdir -p .secrets && docker compose --profile setup run --rm keystore-init` creates both files;
   a second run refuses to overwrite.
3. `docker compose run --rm android-build` exits 0 and prints a signed APK path.
4. `apksigner verify --verbose` passes; `aapt2 dump badging` shows `org.totschnig.myexpenses`.
5. A second release build reuses the Gradle cache and does not reinstall the SDK.
6. `BUILD_VARIANT=debug docker compose run --rm android-build` works without `.secrets`.
7. Temporarily hiding the secrets produces a clear failure (no partial signed APK).
8. `find . -user root -not -path './.git/*'` is empty; `git status` shows no secrets.
9. README commands match the verified commands.
10. Report the signed APK size and confirm the release build is minified/shrunk. Document that the
    universal APK contains all 8 dynamic features, the native ABIs of its dependencies and the
    configured languages, while the app loads feature code/resources on demand at runtime.
11. Measure wall-clock time and peak container memory with the serial default. Measured on 12 CPU
    cores / 30 GB RAM: first uncached build peaked at ~7.9 GB (8 GB too tight); clean rebuild with
    cache ~30 s / ~1.5 GB; incremental rebuild ~20 s; APK ~36 MB. Document the figures; do not
    enable parallel by default.

## Parallelizable work

- `.dockerignore`/`.gitignore` and the README draft can be prepared while the image builds.
- `keystore-init.sh` can be written alongside `entrypoint.sh`, but is verified after the image exists.

## Out of scope (inherits from the spec)

Play Store/AAB, CI, Gradle signingConfig, registry publishing, emulator tests, multi-arch, signing
the release as debug.
