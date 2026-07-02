package de.tum.aet.devops26.team99downtime.transaction;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import de.tum.aet.devops26.team99downtime.transaction.domain.FreeTextTooVagueException;
import de.tum.aet.devops26.team99downtime.transaction.dto.SkippedRow;
import de.tum.aet.devops26.team99downtime.transaction.service.CategoryClient;
import de.tum.aet.devops26.team99downtime.transaction.service.GenAiClient;
import de.tum.aet.devops26.team99downtime.transaction.service.ThresholdCheckClient;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class TransactionFlowIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @MockitoBean private ThresholdCheckClient thresholdCheckClient;
  @MockitoBean private CategoryClient categoryClient;
  @MockitoBean private GenAiClient genAiClient;

  private static JwtRequestPostProcessor asUser(String userId) {
    return jwt().jwt(b -> b.subject(userId));
  }

  // The manual create/update path validates the category against the user's owned
  // categories (budget-service). Stub the ids the create tests below use so they
  // pass validation; free-text/import tests re-stub this with their own values.
  @BeforeEach
  void stubOwnedCategories() {
    when(categoryClient.list(nullable(String.class)))
        .thenReturn(
            List.of(
                new CategoryClient.CategoryDto(
                    UUID.fromString("00000000-0000-0000-0000-000000000001"), "One"),
                new CategoryClient.CategoryDto(
                    UUID.fromString("00000000-0000-0000-0000-000000000002"), "Two"),
                new CategoryClient.CategoryDto(
                    UUID.fromString("00000000-0000-0000-0000-000000000003"), "Three"),
                new CategoryClient.CategoryDto(
                    UUID.fromString("00000000-0000-0000-0000-000000000009"), "Nine")));
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
  void deleteRecomputesSpendThatBudgetsReadFrom() throws Exception {
    // The budget-service computes each category's spend live from GET
    // /api/transactions/spend, so proving that endpoint drops after a delete
    // proves budgets recompute (US-9). A threshold-check also fires per delete.
    String userId = "tx-delete-budget";
    String categoryId = "00000000-0000-0000-0000-000000000009";
    String thisMonth = LocalDate.now().withDayOfMonth(10).toString();

    String createBody =
        String.format(
            "{\"categoryId\":\"%s\",\"amount\":%s,\"currency\":\"EUR\","
                + "\"description\":\"%s\",\"date\":\"%s\"}",
            categoryId, "%s", "%s", thisMonth);

    String first =
        mockMvc
            .perform(
                post("/api/transactions")
                    .with(asUser(userId))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(String.format(createBody, "30.00", "First")))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    mockMvc
        .perform(
            post("/api/transactions")
                .with(asUser(userId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(String.format(createBody, "20.00", "Second")))
        .andExpect(status().isCreated());

    // Both transactions counted: 30 + 20 = 50.
    mockMvc
        .perform(get("/api/transactions/spend").with(asUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[?(@.categoryId=='" + categoryId + "')].totalSpent").value(50.0));

    String firstId = objectMapper.readTree(first).get("id").asText();
    mockMvc
        .perform(delete("/api/transactions/" + firstId).with(asUser(userId)))
        .andExpect(status().isNoContent());

    // After deleting the 30.00 entry, spend recomputes down to 20.
    mockMvc
        .perform(get("/api/transactions/spend").with(asUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[?(@.categoryId=='" + categoryId + "')].totalSpent").value(20.0));
  }

  @Test
  void freeTextSentenceBecomesTransactions() throws Exception {
    String userId = "tx-freetext-user";
    UUID diningId = UUID.randomUUID();
    // No Authorization header in MockMvc tests (jwt() fills the security context
    // directly), so the forwarded auth header is null here.
    when(categoryClient.list(nullable(String.class)))
        .thenReturn(List.of(new CategoryClient.CategoryDto(diningId, "Dining")));
    when(genAiClient.categorize(
            eq("coffee 3 and lunch 8.50 at mensa"), anyList(), nullable(String.class)))
        .thenReturn(
            List.of(
                new GenAiClient.CategorizedExpense(
                    new BigDecimal("3.00"), "EUR", "Coffee", "Dining", LocalDate.of(2026, 6, 1)),
                new GenAiClient.CategorizedExpense(
                    new BigDecimal("8.50"), "EUR", "Mensa", "Dining", LocalDate.of(2026, 6, 1))));

    mockMvc
        .perform(
            post("/api/transactions/free-text")
                .with(asUser(userId))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"text\":\"coffee 3 and lunch 8.50 at mensa\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].description").value("Coffee"))
        .andExpect(jsonPath("$[1].categoryId").value(diningId.toString()));

    mockMvc
        .perform(get("/api/transactions").with(asUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(2));
  }

  @Test
  void vagueFreeTextIs422WithPresetError() throws Exception {
    when(categoryClient.list(nullable(String.class)))
        .thenReturn(List.of(new CategoryClient.CategoryDto(UUID.randomUUID(), "Dining")));
    when(genAiClient.categorize(eq("spent 50 on stuff"), anyList(), nullable(String.class)))
        .thenThrow(new FreeTextTooVagueException());

    mockMvc
        .perform(
            post("/api/transactions/free-text")
                .with(asUser("tx-vague-user"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"text\":\"spent 50 on stuff\"}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.error").value("too_vague"));
  }

  @Test
  void csvImportPersistsRowsAndReportsSkips() throws Exception {
    String userId = "tx-import-user";
    UUID groceriesId = UUID.randomUUID();
    String csv = "Buchungstag;Auftraggeber;Betrag\n01.07.2026;REWE;-12,30\n01.07.2026;GEHALT;+2500";
    when(categoryClient.list(nullable(String.class)))
        .thenReturn(List.of(new CategoryClient.CategoryDto(groceriesId, "Groceries")));
    when(genAiClient.parseFile(eq(csv), anyList(), nullable(String.class)))
        .thenReturn(
            new GenAiClient.FileParseResult(
                List.of(
                    new GenAiClient.RowExpense(
                        2,
                        new BigDecimal("12.30"),
                        "EUR",
                        "Rewe",
                        "Groceries",
                        LocalDate.of(2026, 7, 1))),
                List.of(new SkippedRow(3, "incoming payment"))));

    mockMvc
        .perform(
            multipart("/api/transactions/import")
                .file(new MockMultipartFile("file", "bank.csv", "text/csv", csv.getBytes()))
                .with(asUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.imported.length()").value(1))
        .andExpect(jsonPath("$.imported[0].description").value("Rewe"))
        .andExpect(jsonPath("$.imported[0].categoryId").value(groceriesId.toString()))
        .andExpect(jsonPath("$.skipped[0].row").value(3))
        .andExpect(jsonPath("$.skipped[0].reason").value("incoming payment"));

    mockMvc
        .perform(get("/api/transactions").with(asUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1));
  }

  @Test
  void textNotesImportKeepsValidLinesAndSkipsVagueOnes() throws Exception {
    String userId = "tx-import-notes";
    UUID diningId = UUID.randomUUID();
    String notes = "lunch at mensa 8.50\nbought some stuff\ncoffee 3 euro";
    when(categoryClient.list(nullable(String.class)))
        .thenReturn(List.of(new CategoryClient.CategoryDto(diningId, "Dining")));
    when(genAiClient.parseFile(eq(notes), anyList(), nullable(String.class)))
        .thenReturn(
            new GenAiClient.FileParseResult(
                List.of(
                    new GenAiClient.RowExpense(
                        1, new BigDecimal("8.50"), "EUR", "Mensa", "Dining", LocalDate.now()),
                    new GenAiClient.RowExpense(
                        3, new BigDecimal("3.00"), "EUR", "Coffee", "Dining", LocalDate.now())),
                List.of(new SkippedRow(2, "too vague"))));

    mockMvc
        .perform(
            multipart("/api/transactions/import")
                .file(new MockMultipartFile("file", "notes.txt", "text/plain", notes.getBytes()))
                .with(asUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.imported.length()").value(2))
        .andExpect(jsonPath("$.skipped[0].row").value(2))
        .andExpect(jsonPath("$.skipped[0].reason").value("too vague"));

    mockMvc
        .perform(get("/api/transactions").with(asUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(2));
  }

  @Test
  void fileWithNoRecognizableExpensesIsRejected() throws Exception {
    when(categoryClient.list(nullable(String.class)))
        .thenReturn(List.of(new CategoryClient.CategoryDto(UUID.randomUUID(), "Dining")));
    when(genAiClient.parseFile(anyString(), anyList(), nullable(String.class)))
        .thenReturn(
            new GenAiClient.FileParseResult(List.of(), List.of(new SkippedRow(1, "too vague"))));

    mockMvc
        .perform(
            multipart("/api/transactions/import")
                .file(new MockMultipartFile("file", "notes.txt", "text/plain", "stuff".getBytes()))
                .with(asUser("tx-import-nothing")))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.error").value("no_expenses"));
  }

  @Test
  void emptyUploadIsRejectedWithPresetError() throws Exception {
    mockMvc
        .perform(
            multipart("/api/transactions/import")
                .file(new MockMultipartFile("file", "bank.csv", "text/csv", new byte[0]))
                .with(asUser("tx-import-empty")))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.error").value("invalid_file"));
  }

  @Test
  void binaryUploadIsRejectedWithPresetError() throws Exception {
    when(categoryClient.list(nullable(String.class)))
        .thenReturn(List.of(new CategoryClient.CategoryDto(UUID.randomUUID(), "Groceries")));
    byte[] binary = {0x25, 0x50, 0x44, 0x46, 0x00, 0x01, 0x02};

    mockMvc
        .perform(
            multipart("/api/transactions/import")
                .file(new MockMultipartFile("file", "statement.pdf", "application/pdf", binary))
                .with(asUser("tx-import-binary")))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.error").value("invalid_file"));
  }

  @Test
  void spendEndpointReturnsCurrentMonthOnly() throws Exception {
    String userId = "tx-spend-user";
    String thisMonthDate = LocalDate.now().withDayOfMonth(15).toString();
    String lastMonthDate = LocalDate.now().minusMonths(1).withDayOfMonth(15).toString();
    String thisMonth =
        String.format(
            "{\"categoryId\":\"00000000-0000-0000-0000-000000000002\","
                + " \"amount\":100.00,\"currency\":\"EUR\","
                + " \"description\":\"Groceries\",\"date\":\"%s\"}",
            thisMonthDate);
    String lastMonth =
        String.format(
            "{\"categoryId\":\"00000000-0000-0000-0000-000000000002\","
                + " \"amount\":200.00,\"currency\":\"EUR\","
                + " \"description\":\"Old\",\"date\":\"%s\"}",
            lastMonthDate);

    mockMvc
        .perform(
            post("/api/transactions")
                .with(asUser(userId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(thisMonth))
        .andExpect(status().isCreated());
    mockMvc
        .perform(
            post("/api/transactions")
                .with(asUser(userId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(lastMonth))
        .andExpect(status().isCreated());

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
