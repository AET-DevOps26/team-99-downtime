package de.tum.aet.devops26.team99downtime.budget.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Configures the service as an OAuth2 resource server: every request must carry a valid RS256 JWT
 * minted by the auth-service, except the public health probe.
 *
 * <p>Tokens are verified against the auth-service's JWKS (RSA public keys) and checked for the
 * expected {@code iss} claim. The service holds no secret and never talks to the auth database —
 * verification is purely via the public keys.
 */
@Configuration
public class SecurityConfig {

  private final String jwkSetUri;
  private final String issuer;

  public SecurityConfig(
      @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") String jwkSetUri,
      @Value("${auth.issuer}") String issuer) {
    this.jwkSetUri = jwkSetUri;
    this.issuer = issuer;
  }

  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http.authorizeHttpRequests(
            auth ->
                auth.requestMatchers("/actuator/health", "/actuator/health/**")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .csrf(AbstractHttpConfigurer::disable);
    return http.build();
  }

  /**
   * Decoder backed by the auth-service JWKS. Validates standard claims (e.g. expiry) plus the
   * expected issuer. We validate the issuer here rather than via {@code issuer-uri} so no OIDC
   * discovery call is made to the browser-facing origin (which is unreachable from inside the
   * network).
   */
  @Bean
  public NimbusJwtDecoder jwtDecoder() {
    NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
    OAuth2TokenValidator<Jwt> withIssuer = new JwtIssuerValidator(issuer);
    OAuth2TokenValidator<Jwt> validator =
        new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefault(), withIssuer);
    decoder.setJwtValidator(validator);
    return decoder;
  }
}
