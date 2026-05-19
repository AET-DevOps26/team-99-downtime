#dev
FROM oven/bun:1-alpine AS dev
RUN apk add --no-cache openjdk21-jre-headless
ENV JAVA_HOME=/usr/lib/jvm/default-jvm \
    PATH="/usr/lib/jvm/default-jvm/bin:$PATH"
WORKDIR /workspace
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
EXPOSE 4200
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=10 \
  CMD wget -q --spider http://localhost:4200 || exit 1
CMD ["bun", "nx", "serve", "client", "--host", "0.0.0.0", "--port", "4200"]

#prod
FROM joseluisq/static-web-server:2-alpine AS prod
ENV SERVER_ROOT=/public \
    SERVER_PAGE_FALLBACK=/public/index.html \
    SERVER_COMPRESSION=true \
    SERVER_CACHE_CONTROL_HEADERS=true
COPY dist/apps/client /public
EXPOSE 80
