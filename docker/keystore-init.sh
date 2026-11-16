#!/usr/bin/env bash
set -euo pipefail

SECRETS_DIR="${SECRETS_DIR:-/secrets}"
ENV_FILE="${SECRETS_DIR}/keystore.env"
KEYSTORE="${SECRETS_DIR}/release.jks"
DEFAULT_ALIAS="myexpenses"

mkdir -p "${SECRETS_DIR}"

if [[ -f "${KEYSTORE}" ]]; then
  cat >&2 <<'EOF'
A release keystore already exists. Refusing to overwrite it.

Android only accepts updates signed with the same key. Keep this file and its
password safe. If you really want a new key, remove .secrets/ manually and
accept that the app must be uninstalled before it can be installed again.
EOF
  exit 1
fi

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

KEY_ALIAS="${KEY_ALIAS:-${DEFAULT_ALIAS}}"
if [[ -z "${KEYSTORE_PASSWORD:-}" ]]; then
  KEYSTORE_PASSWORD="$(openssl rand -base64 32 | tr -d '\n')"
fi

umask 077
if [[ ! -f "${ENV_FILE}" ]]; then
  printf 'KEYSTORE_PASSWORD=%s\nKEY_ALIAS=%s\n' "${KEYSTORE_PASSWORD}" "${KEY_ALIAS}" > "${ENV_FILE}"
  echo "Generated ${ENV_FILE}"
else
  echo "Reusing ${ENV_FILE}"
fi
chmod 600 "${ENV_FILE}"

echo "Generating a new signing key." >&2
echo "If an app was already installed with a different key, it will not accept this as an update." >&2
export KEYSTORE_PASSWORD KEY_ALIAS

keytool -genkeypair \
  -storetype PKCS12 \
  -keystore "${KEYSTORE}" \
  -alias "${KEY_ALIAS}" \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -dname "CN=MyExpenses, O=Personal" \
  -storepass:env KEYSTORE_PASSWORD \
  -keypass:env KEYSTORE_PASSWORD

chmod 600 "${KEYSTORE}"
keytool -list -keystore "${KEYSTORE}" -storepass:env KEYSTORE_PASSWORD > /dev/null

cat <<EOF

Keystore created:
  ${KEYSTORE}
  ${ENV_FILE}

Back up the whole .secrets/ directory somewhere safe. Without it you cannot
sign updates that Android will install over the current app.
EOF
