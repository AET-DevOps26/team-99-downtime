package de.tum.aet.devops26.team99downtime.transaction.web;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import de.tum.aet.devops26.team99downtime.commons.security.SecurityConfig;
import de.tum.aet.devops26.team99downtime.transaction.service.TransactionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(TransactionController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
@TestPropertySource(
    properties = {
      "spring.security.oauth2.resourceserver.jwt.jwk-set-uri=http://auth-service:3000/api/auth/jwks",
      "auth.issuer=http://localhost:9099"
    })
class TransactionControllerTest {

  @Autowired private MockMvc mockMvc;
  @MockitoBean private TransactionService service;

  @Test
  void rejectsRequestWithoutToken() throws Exception {
    mockMvc
        .perform(
            post("/api/transactions").contentType(MediaType.APPLICATION_JSON).content(validBody()))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void rejectsMissingAmount() throws Exception {
    mockMvc
        .perform(
            post("/api/transactions")
                .with(jwt().jwt(b -> b.subject("u1")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"categoryId":"00000000-0000-0000-0000-000000000001",
                     "currency":"EUR","description":"X","date":"2026-06-01"}
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fields.amount").exists());
  }

  private static String validBody() {
    return """
        {"categoryId":"00000000-0000-0000-0000-000000000001",
         "amount":10.00,"currency":"EUR","description":"X","date":"2026-06-01"}
        """;
  }
}
