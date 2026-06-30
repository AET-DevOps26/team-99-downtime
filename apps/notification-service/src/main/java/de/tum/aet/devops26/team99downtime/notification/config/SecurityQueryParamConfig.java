package de.tum.aet.devops26.team99downtime.notification.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;

@Configuration
public class SecurityQueryParamConfig {

  @Bean
  public DefaultBearerTokenResolver bearerTokenResolver() {
    DefaultBearerTokenResolver resolver = new DefaultBearerTokenResolver();
    resolver.setAllowUriQueryParameter(true);
    return resolver;
  }
}
