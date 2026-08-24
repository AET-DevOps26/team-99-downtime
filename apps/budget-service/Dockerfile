# dev
FROM eclipse-temurin:21-jdk-alpine@sha256:6ea5548706b60ac0a602eaf48af74792cbab012d90e811ca8db6184b16b5c3d6 AS dev
WORKDIR /workspace
RUN apk add --no-cache bash
EXPOSE 8082
HEALTHCHECK --interval=10s --timeout=3s --start-period=120s --retries=20 \
  CMD wget -q --spider http://localhost:8082/actuator/health || exit 1
# nosemgrep: dockerfile.security.missing-user.missing-user — dev-only image, host bind-mount breaks non-root user
CMD ["./gradlew", "--no-daemon", ":budget-service:bootRun", "--continuous"]

# prod
FROM eclipse-temurin:21-jre-alpine@sha256:974b08960c5d96694c780e65b2d5705268ab1e1ca1a0dd0caf4ba6c3fe34d699 AS prod
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY dist/apps/budget-service/app.jar /app/app.jar
USER app
EXPOSE 8082
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
