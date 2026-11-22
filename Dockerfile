FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN --mount=type=secret,id=ca_bundle \
    if [ -f /run/secrets/ca_bundle ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca_bundle; fi; \
    npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM maven:3.9.11-eclipse-temurin-21 AS backend
WORKDIR /app
COPY pom.xml ./
COPY src/main/ src/main/
COPY --from=frontend /app/frontend/dist/ frontend/dist/
RUN --mount=type=secret,id=maven_settings --mount=type=secret,id=java_truststore \
    if [ -f /run/secrets/java_truststore ]; then \
      export JAVA_TOOL_OPTIONS="-Djavax.net.ssl.trustStore=/run/secrets/java_truststore"; \
    fi; \
    if [ -f /run/secrets/maven_settings ]; then \
      mvn -B -s /run/secrets/maven_settings -DskipTests package; \
    else \
      mvn -B -DskipTests package; \
    fi

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=backend /app/target/commons-0.1.0.jar /app/campus.jar
USER 10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/campus.jar"]
