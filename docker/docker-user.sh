#!/usr/bin/env bash
# Shared uid/gid setup, sourced by entrypoint.sh and keystore-init.sh.
#
# The image is built with fixed USER_ID/GROUP_ID build args (default 1000), but
# the container may run as any uid/gid at runtime (compose passes HOST_UID and
# HOST_GID). The image-baked state (/home/builder as HOME, /gradle-cache as
# GRADLE_USER_HOME) must match the runtime user or Gradle, Git and Robolectric
# all fail with permission errors.
#
# When the entrypoints start as root (the compose default), ownership of those
# directories is aligned with the runtime uid/gid and privileges are dropped
# with setpriv, so nothing after this point runs as root. A non-root start
# (e.g. `docker run --user ...`) cannot chown; it falls back to a writable HOME.

docker_user_prepare() {
  local target_uid="${HOST_UID:-${USER_ID:-1000}}"
  local target_gid="${HOST_GID:-${GROUP_ID:-1000}}"

  if [[ "$(id -u)" != "0" ]]; then
    if [[ -n "${HOME:-}" && ! -w "${HOME}" ]]; then
      local writable_home="/tmp/builder-home-${target_uid}"
      mkdir -p "${writable_home}" 2>/dev/null || true
      if [[ -w "${writable_home}" ]]; then
        export HOME="${writable_home}"
      fi
    fi
    return 0
  fi

  local dir
  for dir in /home/builder /gradle-cache; do
    if [[ -d "${dir}" && "$(stat -c '%u:%g' "${dir}")" != "${target_uid}:${target_gid}" ]]; then
      chown -R "${target_uid}:${target_gid}" "${dir}"
    fi
  done

  # Re-exec this script as the runtime user; the rest runs unprivileged.
  local self="$0"
  case "${self}" in
    /*) ;;
    */*) self="$PWD/${self}" ;;
    *) self="$(command -v -- "${self}" || echo "${self}")" ;;
  esac
  exec setpriv --reuid="${target_uid}" --regid="${target_gid}" --clear-groups "${self}" "$@"
}
