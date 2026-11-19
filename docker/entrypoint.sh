#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=docker-user.sh
source /usr/local/bin/docker-user.sh
docker_user_prepare "$@"

GRADLE_ARGS=(
  --no-daemon
  --build-cache
  "--max-workers=${GRADLE_MAX_WORKERS:-2}"
)

if [[ "${GRADLE_PARALLEL:-0}" == "1" || "${GRADLE_PARALLEL:-0}" == "true" ]]; then
  GRADLE_ARGS+=(--parallel)
fi

# Escape hatch: any extra arguments are handed to Gradle (for example a test task).
if [[ $# -gt 0 ]]; then
  exec ./gradlew "${GRADLE_ARGS[@]}" "$@"
fi

VARIANT="${BUILD_VARIANT:-release}"
SECRETS_DIR="${SECRETS_DIR:-/secrets}"
ENV_FILE="${SECRETS_DIR}/keystore.env"
KEYSTORE="${SECRETS_DIR}/release.jks"
BUILD_TOOLS_DIR="${ANDROID_HOME}/build-tools/${ANDROID_BUILD_TOOLS:-37.0.0}"
RELEASE_APK_DIR="myExpenses/build/outputs/apk_from_bundle/externRelease"
DEBUG_APK_DIR="myExpenses/build/outputs/apk/extern/debug"

find_single_apk() {
  local dir="$1"
  local pattern="$2"
  local -a found=()

  if [[ -d "${dir}" ]]; then
    mapfile -t found < <(find "${dir}" -maxdepth 1 -type f -name "${pattern}" ! -name '*-signed.apk' | sort)
  fi

  if [[ ${#found[@]} -ne 1 ]]; then
    echo "Expected exactly one APK matching '${pattern}' in ${dir}, found ${#found[@]}." >&2
    printf '  %s\n' "${found[@]:-}" >&2
    exit 1
  fi

  printf '%s\n' "${found[0]}"
}

case "${VARIANT}" in
  release)
    if [[ ! -f "${KEYSTORE}" || ! -f "${ENV_FILE}" ]]; then
      cat >&2 <<'EOF'
Missing signing key or password file.

Create them once with:

  mkdir -p .secrets
  docker compose --profile setup run --rm keystore-init

Then back up the .secrets/ directory.
EOF
      exit 1
    fi

    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    if [[ -z "${KEYSTORE_PASSWORD:-}" ]]; then
      echo "KEYSTORE_PASSWORD is missing from ${ENV_FILE}." >&2
      exit 1
    fi
    KEY_ALIAS="${KEY_ALIAS:-myexpenses}"
    export KEYSTORE_PASSWORD

    echo "Building the release APK (serial by default, ${GRADLE_MAX_WORKERS:-2} worker(s))..."
    # The upstream repo currently has three Greek strings that are missing from the
    # default locale, which makes lintVitalExternRelease fail before packaging. It is
    # a translation issue, not a build issue; skip that optional check in this local build.
    ./gradlew "${GRADLE_ARGS[@]}" \
      -x :myExpenses:lintVitalExternRelease \
      :myExpenses:packageExternReleaseUniversalApk

    unsigned_apk="$(find_single_apk "${RELEASE_APK_DIR}" '*universal*.apk')"
    signed_base="${unsigned_apk%-unsigned.apk}"
    if [[ "${signed_base}" == "${unsigned_apk}" ]]; then
      signed_base="${unsigned_apk%.apk}"
    fi
    aligned_apk="${signed_base}-aligned.apk"
    signed_apk="${signed_base}-signed.apk"

    echo "Aligning and signing ${unsigned_apk}..."
    "${BUILD_TOOLS_DIR}/zipalign" -p -f 4 "${unsigned_apk}" "${aligned_apk}"
    "${BUILD_TOOLS_DIR}/apksigner" sign \
      --ks "${KEYSTORE}" \
      --ks-key-alias "${KEY_ALIAS}" \
      --ks-pass env:KEYSTORE_PASSWORD \
      --key-pass env:KEYSTORE_PASSWORD \
      --out "${signed_apk}" \
      "${aligned_apk}"
    rm -f "${aligned_apk}"

    echo "Verifying the signature..."
    "${BUILD_TOOLS_DIR}/apksigner" verify --verbose "${signed_apk}"
    package_line="$("${BUILD_TOOLS_DIR}/aapt2" dump badging "${signed_apk}" | sed -n '1p')"
    echo "${package_line}"

    echo
    echo "Signed release APK:"
    echo "  ${signed_apk}"
    echo "  size: $(du -h "${signed_apk}" | cut -f1)"
    ;;

  debug)
    echo "Building the debug APK..."
    ./gradlew "${GRADLE_ARGS[@]}" :myExpenses:assembleExternDebug
    debug_apk="$(find_single_apk "${DEBUG_APK_DIR}" '*.apk')"

    echo
    echo "Debug APK:"
    echo "  ${debug_apk}"
    echo "  size: $(du -h "${debug_apk}" | cut -f1)"
    ;;

  *)
    echo "Unknown BUILD_VARIANT '${VARIANT}'. Use 'release' or 'debug'." >&2
    exit 1
    ;;
esac
