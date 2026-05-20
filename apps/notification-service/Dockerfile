# dev
FROM eclipse-temurin:21-jdk-alpine AS dev
WORKDIR /workspace
RUN apk add --no-cache bash
EXPOSE 8081
HEALTHCHECK --interval=10s --timeout=3s --start-period=120s --retries=20 \
  CMD wget -q --spider http://localhost:8081/actuator/health || exit 1
CMD ["./gradlew", "--no-daemon", ":notification-service:bootRun", "--continuous"]

#prod
FROM eclipse-temurin:21-jre-alpine AS prod
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY dist/apps/notification-service/app.jar /app/app.jar
USER app
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
