package de.tum.aet.devops26.team99downtime.transaction.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import de.tum.aet.devops26.team99downtime.transaction.domain.NoCategoriesException;
import de.tum.aet.devops26.team99downtime.transaction.domain.Transaction;
import de.tum.aet.devops26.team99downtime.transaction.dto.SkippedRow;
import de.tum.aet.devops26.team99downtime.transaction.repository.TransactionRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TransactionServiceImportTest {

  private static final String AUTH = "Bearer token";
  private static final UUID GROCERIES = UUID.randomUUID();
  private static final LocalDate DATE = LocalDate.of(2026, 7, 1);

  @Mock private TransactionRepository repository;
  @Mock private ThresholdCheckClient thresholdCheckClient;
  @Mock private CategoryClient categoryClient;
  @Mock private GenAiClient genAiClient;
  @InjectMocks private TransactionService service;

  private void givenCategories() {
    when(categoryClient.list(AUTH))
        .thenReturn(List.of(new CategoryClient.CategoryDto(GROCERIES, "Groceries")));
  }

  private static GenAiClient.CsvExpense expense(int row, String category) {
    return new GenAiClient.CsvExpense(row, new BigDecimal("12.30"), "EUR", "Rewe", category, DATE);
  }

  @Test
  void importsRowsAndKeepsGenAiSkips() {
    givenCategories();
    when(genAiClient.parseCsv(anyString(), anyList(), anyString()))
        .thenReturn(
            new GenAiClient.CsvParseResult(
                List.of(expense(2, "groceries")), List.of(new SkippedRow(3, "incoming payment"))));
    when(repository.save(any(Transaction.class))).thenAnswer(inv -> inv.getArgument(0));

    TransactionService.CsvImportOutcome outcome = service.importCsv("u1", "csv...", AUTH);

    assertEquals(1, outcome.imported().size());
    assertEquals(GROCERIES, outcome.imported().get(0).getCategoryId());
    assertEquals(List.of(new SkippedRow(3, "incoming payment")), outcome.skipped());
    verify(thresholdCheckClient).trigger(AUTH);
  }

  @Test
  void unknownCategoryRowIsSkippedNotFatal() {
    givenCategories();
    when(genAiClient.parseCsv(anyString(), anyList(), anyString()))
        .thenReturn(
            new GenAiClient.CsvParseResult(
                List.of(expense(2, "Groceries"), expense(4, "Travel")), List.of()));
    when(repository.save(any(Transaction.class))).thenAnswer(inv -> inv.getArgument(0));

    TransactionService.CsvImportOutcome outcome = service.importCsv("u1", "csv...", AUTH);

    assertEquals(1, outcome.imported().size());
    assertEquals(1, outcome.skipped().size());
    assertEquals(4, outcome.skipped().get(0).row());
    assertTrue(outcome.skipped().get(0).reason().contains("Travel"));
  }

  @Test
  void noImportedRowsSkipsThresholdCheck() {
    givenCategories();
    when(genAiClient.parseCsv(anyString(), anyList(), anyString()))
        .thenReturn(
            new GenAiClient.CsvParseResult(List.of(), List.of(new SkippedRow(2, "no amount"))));

    TransactionService.CsvImportOutcome outcome = service.importCsv("u1", "csv...", AUTH);

    assertTrue(outcome.imported().isEmpty());
    verifyNoInteractions(thresholdCheckClient, repository);
  }

  @Test
  void rejectsWhenUserHasNoCategories() {
    when(categoryClient.list(AUTH)).thenReturn(List.of());

    assertThrows(NoCategoriesException.class, () -> service.importCsv("u1", "csv...", AUTH));
    verifyNoInteractions(genAiClient, repository);
  }
}
