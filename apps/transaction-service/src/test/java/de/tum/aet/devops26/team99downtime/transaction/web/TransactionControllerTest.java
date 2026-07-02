package de.tum.aet.devops26.team99downtime.transaction.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.tum.aet.devops26.team99downtime.commons.security.SecurityConfig;
import de.tum.aet.devops26.team99downtime.transaction.domain.Transaction;
import de.tum.aet.devops26.team99downtime.transaction.domain.UnknownCategoryException;
import de.tum.aet.devops26.team99downtime.transaction.dto.TransactionRequest;
import de.tum.aet.devops26.team99downtime.transaction.service.TransactionService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
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

  @Test
  void listReturnsRequestedPageSortedByDateDescending() throws Exception {
    Transaction tx =
        new Transaction(
            "u1",
            UUID.fromString("00000000-0000-0000-0000-000000000001"),
            new BigDecimal("8.50"),
            "EUR",
            "Lunch at Mensa",
            LocalDate.of(2026, 6, 15));
    Page<Transaction> page = new PageImpl<>(List.of(tx), PageRequest.of(1, 5), 12);
    when(service.list(eq("u1"), any(Pageable.class))).thenReturn(page);

    mockMvc
        .perform(get("/api/transactions?page=1&size=5").with(jwt().jwt(b -> b.subject("u1"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].description").value("Lunch at Mensa"))
        .andExpect(jsonPath("$.content[0].amount").value(8.50))
        .andExpect(jsonPath("$.number").value(1))
        .andExpect(jsonPath("$.size").value(5))
        .andExpect(jsonPath("$.totalElements").value(12))
        .andExpect(jsonPath("$.totalPages").value(3));

    ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
    verify(service).list(eq("u1"), pageable.capture());
    assertThat(pageable.getValue().getPageNumber()).isEqualTo(1);
    assertThat(pageable.getValue().getPageSize()).isEqualTo(5);
    assertThat(pageable.getValue().getSort()).isEqualTo(Sort.by("date").descending());
  }

  @Test
  void rejectsUnknownCategoryWith422() throws Exception {
    when(service.create(eq("u1"), any(TransactionRequest.class), nullable(String.class)))
        .thenThrow(
            new UnknownCategoryException(UUID.fromString("00000000-0000-0000-0000-000000000001")));

    mockMvc
        .perform(
            post("/api/transactions")
                .with(jwt().jwt(b -> b.subject("u1")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(validBody()))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.error").value("unknown_category"));
  }

  private static String validBody() {
    return """
        {"categoryId":"00000000-0000-0000-0000-000000000001",
         "amount":10.00,"currency":"EUR","description":"X","date":"2026-06-01"}
        """;
  }
}
