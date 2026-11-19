# syntax=docker/dockerfile:1

FROM eclipse-temurin:21-jdk-noble

ARG ANDROID_CMDLINE_TOOLS_VERSION=16111833
ARG ANDROID_PLATFORM=android-37.0
ARG ANDROID_BUILD_TOOLS=37.0.0
ARG ANDROID_BUILD_TOOLS_FALLBACK=36.0.0
ARG USER_ID=1000
ARG GROUP_ID=1000

ENV DEBIAN_FRONTEND=noninteractive \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    ANDROID_PLATFORM=${ANDROID_PLATFORM} \
    ANDROID_BUILD_TOOLS=${ANDROID_BUILD_TOOLS} \
    ANDROID_USER_HOME=/home/builder/.android \
    GRADLE_USER_HOME=/gradle-cache \
    HOME=/home/builder \
    USER_ID=${USER_ID} \
    GROUP_ID=${GROUP_ID}

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        openssl \
        unzip \
    && rm -rf /var/lib/apt/lists/*

# Temurin images can already use UID/GID 1000; create them only when missing.
RUN if ! getent group "${GROUP_ID}" > /dev/null; then \
        groupadd --gid "${GROUP_ID}" builder; \
    fi \
    && if ! getent passwd "${USER_ID}" > /dev/null; then \
        useradd --uid "${USER_ID}" --gid "${GROUP_ID}" --create-home --shell /bin/bash builder; \
    fi \
    && mkdir -p /home/builder/.android

RUN mkdir -p "${ANDROID_HOME}/cmdline-tools" \
    && curl -fsSL \
        "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS_VERSION}_latest.zip" \
        -o /tmp/cmdline-tools.zip \
    && unzip -q /tmp/cmdline-tools.zip -d "${ANDROID_HOME}/cmdline-tools" \
    && mv "${ANDROID_HOME}/cmdline-tools/cmdline-tools" "${ANDROID_HOME}/cmdline-tools/latest" \
    && rm /tmp/cmdline-tools.zip

ENV PATH="${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/build-tools/${ANDROID_BUILD_TOOLS}:${PATH}"

RUN yes | sdkmanager --licenses > /dev/null \
    && sdkmanager --install \
        "platform-tools" \
        "platforms;${ANDROID_PLATFORM}" \
        "build-tools;${ANDROID_BUILD_TOOLS}" \
        "build-tools;${ANDROID_BUILD_TOOLS_FALLBACK}" \
    && rm -rf "${ANDROID_HOME}/.temp" "${ANDROID_HOME}/.downloadIntermediates"

RUN mkdir -p /gradle-cache \
    && chown -R "${USER_ID}:${GROUP_ID}" /home/builder /gradle-cache "${ANDROID_HOME}"

COPY docker/entrypoint.sh docker/keystore-init.sh docker/docker-user.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/keystore-init.sh /usr/local/bin/docker-user.sh

WORKDIR /workspace

# The entrypoints start as root so they can align the baked /home/builder and
# /gradle-cache ownership with the uid/gid the container actually runs as
# (compose passes HOST_UID/HOST_GID as environment), then drop privileges via
# setpriv before running Gradle or keytool. Nothing user-facing runs as root.
ENTRYPOINT ["entrypoint.sh"]
CMD []
