#dev
FROM oven/bun:1-alpine@sha256:07235578f79ef8c6f97d94aee7938e76f5cdba5f21ae5dbfdd3d3d38058437eb AS dev
RUN apk add --no-cache openjdk21-jre-headless nodejs npm
ENV JAVA_HOME=/usr/lib/jvm/default-jvm \
    PATH="/usr/lib/jvm/default-jvm/bin:$PATH"
WORKDIR /workspace
EXPOSE 4200
# 127.0.0.1, not localhost: in-container localhost resolves to ::1 first, but
# the dev server binds IPv4 only, so the probe would always fail.
HEALTHCHECK --interval=10s --timeout=3s --start-period=60s --retries=15 \
    CMD wget -q --spider http://127.0.0.1:4200 || exit 1
CMD ["sh", "-c", "bun install --frozen-lockfile && exec bun nx serve client --host 0.0.0.0"]

#prod
FROM joseluisq/static-web-server:2-alpine@sha256:c6704bc8f1fe05378d91c3288495ce2e0131cf31cf8956f117cb1c7d83c49c31 AS prod
ENV SERVER_ROOT=/public \
    SERVER_FALLBACK_PAGE=/public/index.html \
    SERVER_COMPRESSION=true \
    SERVER_CACHE_CONTROL_HEADERS=true \
    SERVER_PORT=8080
COPY dist/apps/client/client /public
EXPOSE 8080
