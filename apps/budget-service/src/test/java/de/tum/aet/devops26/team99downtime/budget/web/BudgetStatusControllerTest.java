package de.tum.aet.devops26.team99downtime.budget.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.tum.aet.devops26.team99downtime.budget.dto.BudgetStatusResponse;
import de.tum.aet.devops26.team99downtime.budget.service.BudgetStatusService;
import de.tum.aet.devops26.team99downtime.commons.security.SecurityConfig;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(BudgetStatusController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
@TestPropertySource(
    properties = {
      "spring.security.oauth2.resourceserver.jwt.jwk-set-uri=http://auth-service:3000/api/auth/jwks",
      "auth.issuer=http://localhost:9099"
    })
class BudgetStatusControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private BudgetStatusService service;

  @Test
  void rejectsRequestWithoutToken() throws Exception {
    mockMvc.perform(get("/api/budgets/status")).andExpect(status().isUnauthorized());
  }

  @Test
  void returnsStatusListForAuthenticatedUser() throws Exception {
    UUID catId = UUID.randomUUID();
    when(service.getStatus(anyString(), any()))
        .thenReturn(
            List.of(
                new BudgetStatusResponse(
                    catId,
                    "Groceries",
                    new BigDecimal("300.00"),
                    new BigDecimal("240.00"),
                    new BigDecimal("60.00"),
                    new BigDecimal("80.00"))));

    mockMvc
        .perform(get("/api/budgets/status").with(jwt().jwt(b -> b.subject("user-1"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].name").value("Groceries"))
        .andExpect(jsonPath("$[0].monthlyLimit").value(300.00))
        .andExpect(jsonPath("$[0].spent").value(240.00))
        .andExpect(jsonPath("$[0].remaining").value(60.00))
        .andExpect(jsonPath("$[0].percentUsed").value(80.00));
  }

  @Test
  void returnsEmptyListWhenUserHasNoCategories() throws Exception {
    when(service.getStatus(anyString(), any())).thenReturn(List.of());

    mockMvc
        .perform(get("/api/budgets/status").with(jwt().jwt(b -> b.subject("new-user"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
  }
}
