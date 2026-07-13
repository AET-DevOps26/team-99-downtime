#dev
FROM oven/bun:1-alpine AS dev
RUN apk add --no-cache openjdk21-jre-headless
ENV JAVA_HOME=/usr/lib/jvm/default-jvm \
    PATH="/usr/lib/jvm/default-jvm/bin:$PATH"
WORKDIR /workspace
COPY package.json bun.lock ./
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=10 \
  CMD wget -q --spider http://localhost:3000/api/auth/ok || exit 1
# Source is bind-mounted in dev; Nx runs the serve target from apps/auth-service.
CMD ["sh", "-c", "bun install --frozen-lockfile && bun nx serve auth-service"]

#prod
FROM oven/bun:1-alpine AS prod
WORKDIR /app
COPY package.json bun.lock ./
# --ignore-scripts skips the root `prepare: husky` hook (husky is a devDependency
# excluded by --production, and prod images don't need git hooks).
RUN bun install --frozen-lockfile --production --ignore-scripts
COPY apps/auth-service/src ./src
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=10 \
  CMD wget -q --spider http://localhost:3000/api/auth/ok || exit 1
RUN addgroup -S appgroup && adduser -S -G appgroup -H appuser
USER appuser
CMD ["bun", "run", "src/server.ts"]
