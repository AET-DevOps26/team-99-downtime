package de.tum.aet.devops26.team99downtime.transaction.web;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.tum.aet.devops26.team99downtime.transaction.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Locks in the security contract of the resource server. Uses Spring Security's {@code jwt()}
 * post-processor to simulate an authenticated principal, so no live auth-service or JWKS fetch is
 * needed — only the filter-chain rules are tested.
 */
@WebMvcTest(WhoAmIController.class)
@Import(SecurityConfig.class)
@TestPropertySource(
    properties = {
      "spring.security.oauth2.resourceserver.jwt.jwk-set-uri=http://auth-service:3000/api/auth/jwks",
      "auth.issuer=http://localhost:9099"
    })
class WhoAmIControllerTest {

  @Autowired private MockMvc mockMvc;

  @Test
  void rejectsRequestWithoutToken() throws Exception {
    mockMvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
  }

  @Test
  void returnsIdentityForAuthenticatedRequest() throws Exception {
    mockMvc
        .perform(
            get("/api/me")
                .with(
                    jwt()
                        .jwt(
                            builder ->
                                builder
                                    .subject("user-123")
                                    .claim("email", "user@team99.dev")
                                    .issuer("http://localhost:9099"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.userId").value("user-123"))
        .andExpect(jsonPath("$.email").value("user@team99.dev"));
  }
}
