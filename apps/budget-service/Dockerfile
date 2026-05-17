FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY dist/apps/budget-service/app.jar /app/app.jar

USER app

EXPOSE 8082

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
