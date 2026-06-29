#dev
FROM oven/bun:1-alpine AS dev
RUN apk add --no-cache openjdk21-jre-headless nodejs npm
ENV JAVA_HOME=/usr/lib/jvm/default-jvm \
    PATH="/usr/lib/jvm/default-jvm/bin:$PATH"
WORKDIR /workspace
EXPOSE 4200
HEALTHCHECK --interval=10s --timeout=3s --start-period=60s --retries=15 \
    CMD wget -q --spider http://localhost:4200 || exit 1
CMD ["sh", "-c", "bun install --frozen-lockfile && bun nx serve client --host 0.0.0.0"]

#prod
FROM joseluisq/static-web-server:2-alpine AS prod
ENV SERVER_ROOT=/public \
    SERVER_PAGE_FALLBACK=/public/index.html \
    SERVER_COMPRESSION=true \
    SERVER_CACHE_CONTROL_HEADERS=true
COPY dist/apps/client/client /public
EXPOSE 80
