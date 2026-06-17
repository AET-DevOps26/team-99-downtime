package de.tum.aet.devops26.team99downtime.commons.openapi;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Bean;

/**
 * Shared OpenAPI metadata for every consuming service. Declares the {@code bearerAuth} scheme — a
 * Better Auth JWT passed as {@code Authorization: Bearer <token>} — so the generated spec documents
 * that every endpoint (bar the public health/docs routes) needs a token, and the Swagger UI's
 * "Authorize" button works.
 *
 * <p>Registered as an {@link AutoConfiguration} (see {@code
 * META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports}) so it applies
 * to services without being on their component-scan path, exactly like {@code SecurityConfig}.
 */
@AutoConfiguration
public class OpenApiConfig {

  private static final String BEARER_SCHEME = "bearerAuth";

  private final String applicationName;

  public OpenApiConfig(@Value("${spring.application.name:service}") String applicationName) {
    this.applicationName = applicationName;
  }

  @Bean
  public OpenAPI team99OpenApi() {
    return new OpenAPI()
        .info(new Info().title(applicationName + " API").version("v1"))
        .components(
            new Components()
                .addSecuritySchemes(
                    BEARER_SCHEME,
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("Better Auth JWT minted by the auth-service.")))
        .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME));
  }
}
