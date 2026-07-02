package de.tum.aet.devops26.team99downtime.transaction.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import de.tum.aet.devops26.team99downtime.transaction.domain.NoCategoriesException;
import de.tum.aet.devops26.team99downtime.transaction.domain.Transaction;
import de.tum.aet.devops26.team99downtime.transaction.domain.UpstreamServiceException;
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
class TransactionServiceFreeTextTest {

  private static final String AUTH = "Bearer token";
  private static final UUID DINING = UUID.randomUUID();
  private static final UUID GROCERIES = UUID.randomUUID();
  private static final LocalDate DATE = LocalDate.of(2026, 7, 1);

  @Mock private TransactionRepository repository;
  @Mock private ThresholdCheckClient thresholdCheckClient;
  @Mock private CategoryClient categoryClient;
  @Mock private GenAiClient genAiClient;
  @InjectMocks private TransactionService service;

  private void givenCategories() {
    when(categoryClient.list(AUTH))
        .thenReturn(
            List.of(
                new CategoryClient.CategoryDto(DINING, "Dining"),
                new CategoryClient.CategoryDto(GROCERIES, "Groceries")));
  }

  @Test
  void savesOneTransactionPerExtractedExpense() {
    givenCategories();
    when(genAiClient.categorize("lunch 8.50, rewe 42", List.of("Dining", "Groceries"), AUTH))
        .thenReturn(
            List.of(
                new GenAiClient.CategorizedExpense(
                    new BigDecimal("8.50"), "EUR", "Mensa", "Dining", DATE),
                // lowercase on purpose: the name match must be case-insensitive
                new GenAiClient.CategorizedExpense(
                    new BigDecimal("42.00"), "EUR", "Rewe", "groceries", DATE)));
    when(repository.save(any(Transaction.class))).thenAnswer(inv -> inv.getArgument(0));

    List<Transaction> saved = service.createFromFreeText("u1", "lunch 8.50, rewe 42", AUTH);

    assertEquals(2, saved.size());
    assertEquals(DINING, saved.get(0).getCategoryId());
    assertEquals(GROCERIES, saved.get(1).getCategoryId());
    assertEquals("Mensa", saved.get(0).getDescription());
    assertEquals(new BigDecimal("8.50"), saved.get(0).getAmount());
    assertEquals(DATE, saved.get(0).getDate());
    verify(thresholdCheckClient).trigger(AUTH);
  }

  @Test
  void defaultsBlankCurrencyToEur() {
    givenCategories();
    when(genAiClient.categorize(anyString(), anyList(), anyString()))
        .thenReturn(
            List.of(
                new GenAiClient.CategorizedExpense(
                    new BigDecimal("3.00"), "", "Coffee", "Dining", DATE)));
    when(repository.save(any(Transaction.class))).thenAnswer(inv -> inv.getArgument(0));

    List<Transaction> saved = service.createFromFreeText("u1", "coffee 3", AUTH);

    assertEquals("EUR", saved.get(0).getCurrency());
  }

  @Test
  void rejectsWhenUserHasNoCategories() {
    when(categoryClient.list(AUTH)).thenReturn(List.of());

    assertThrows(
        NoCategoriesException.class, () -> service.createFromFreeText("u1", "coffee 3", AUTH));
    verifyNoInteractions(genAiClient, repository);
  }

  @Test
  void unknownCategoryFromAiIsAnUpstreamError() {
    givenCategories();
    when(genAiClient.categorize(anyString(), anyList(), anyString()))
        .thenReturn(
            List.of(
                new GenAiClient.CategorizedExpense(
                    new BigDecimal("9.99"), "EUR", "DB", "Travel", DATE)));

    assertThrows(
        UpstreamServiceException.class, () -> service.createFromFreeText("u1", "train 9.99", AUTH));
  }
}
