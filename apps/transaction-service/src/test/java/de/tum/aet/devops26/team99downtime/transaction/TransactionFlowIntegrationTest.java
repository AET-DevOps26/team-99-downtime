package de.tum.aet.devops26.team99downtime.transaction;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.tum.aet.devops26.team99downtime.transaction.service.ThresholdCheckClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class TransactionFlowIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @MockitoBean private ThresholdCheckClient thresholdCheckClient;

  private static JwtRequestPostProcessor asUser(String userId) {
    return jwt().jwt(b -> b.subject(userId));
  }

  @Test
  void createListDeleteFlow() throws Exception {
    String userId = "tx-flow-user";
    String body =
        """
        {"categoryId":"00000000-0000-0000-0000-000000000001",
         "amount":42.50,"currency":"EUR",
         "description":"Lunch","date":"2026-06-01"}
        """;

    String created =
        mockMvc
            .perform(
                post("/api/transactions")
                    .with(asUser(userId))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.description").value("Lunch"))
            .andReturn()
            .getResponse()
            .getContentAsString();

    String id = objectMapper.readTree(created).get("id").asText();

    mockMvc
        .perform(get("/api/transactions").with(asUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].description").value("Lunch"));

    mockMvc
        .perform(delete("/api/transactions/" + id).with(asUser(userId)))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(get("/api/transactions").with(asUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content").isEmpty());
  }

  @Test
  void spendEndpointReturnsCurrentMonthOnly() throws Exception {
    String userId = "tx-spend-user";
    String thisMonth =
        """
        {"categoryId":"00000000-0000-0000-0000-000000000002",
         "amount":100.00,"currency":"EUR",
         "description":"Groceries","date":"2026-06-15"}
        """;
    String lastMonth =
        """
        {"categoryId":"00000000-0000-0000-0000-000000000002",
         "amount":200.00,"currency":"EUR",
         "description":"Old","date":"2026-05-15"}
        """;

    mockMvc.perform(
        post("/api/transactions")
            .with(asUser(userId))
            .contentType(MediaType.APPLICATION_JSON)
            .content(thisMonth));
    mockMvc.perform(
        post("/api/transactions")
            .with(asUser(userId))
            .contentType(MediaType.APPLICATION_JSON)
            .content(lastMonth));

    mockMvc
        .perform(get("/api/transactions/spend").with(asUser(userId)))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$[?(@.categoryId=='00000000-0000-0000-0000-000000000002')].totalSpent")
                .value(100.0));
  }

  @Test
  void cannotTouchAnotherUsersTransaction() throws Exception {
    String created =
        mockMvc
            .perform(
                post("/api/transactions")
                    .with(asUser("tx-owner"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                    {"categoryId":"00000000-0000-0000-0000-000000000003",
                     "amount":10.00,"currency":"EUR",
                     "description":"Mine","date":"2026-06-01"}
                    """))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();

    String id = objectMapper.readTree(created).get("id").asText();

    mockMvc
        .perform(delete("/api/transactions/" + id).with(asUser("tx-intruder")))
        .andExpect(status().isNotFound());
  }
}
