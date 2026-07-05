package de.tum.aet.devops26.team99downtime.transaction.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import de.tum.aet.devops26.team99downtime.transaction.domain.Transaction;
import de.tum.aet.devops26.team99downtime.transaction.domain.TransactionNotFoundException;
import de.tum.aet.devops26.team99downtime.transaction.domain.UnknownCategoryException;
import de.tum.aet.devops26.team99downtime.transaction.dto.SpendEntry;
import de.tum.aet.devops26.team99downtime.transaction.dto.TransactionRequest;
import de.tum.aet.devops26.team99downtime.transaction.repository.TransactionRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

  private static final String USER_ID = "user-1";
  private static final String AUTH = "Bearer token";
  private static final UUID CATEGORY_ID = UUID.randomUUID();
  private static final LocalDate DATE = LocalDate.of(2026, 7, 1);

  @Mock private TransactionRepository repository;
  @Mock private ThresholdCheckClient thresholdCheckClient;
  @Mock private CategoryClient categoryClient;
  @Mock private GenAiClient genAiClient;
  @InjectMocks private TransactionService service;

  @Test
  void listDelegatesToRepositoryForUserAndPage() {
    Pageable pageable = PageRequest.of(0, 20);
    Page<Transaction> page = new PageImpl<>(List.of(transaction()));
    when(repository.findByUserIdOrderByDateDescCreatedAtDesc(USER_ID, pageable)).thenReturn(page);

    Page<Transaction> result = service.list(USER_ID, pageable);

    assertSame(page, result);
    verify(repository).findByUserIdOrderByDateDescCreatedAtDesc(USER_ID, pageable);
  }

  @Test
  void createSavesTransactionForKnownCategoryAndTriggersThresholdCheck() {
    givenCategoryExists();
    when(repository.save(any(Transaction.class))).thenAnswer(inv -> inv.getArgument(0));

    Transaction saved = service.create(USER_ID, request(), AUTH);

    assertEquals(USER_ID, saved.getUserId());
    assertEquals(CATEGORY_ID, saved.getCategoryId());
    assertEquals(new BigDecimal("12.30"), saved.getAmount());
    assertEquals("EUR", saved.getCurrency());
    assertEquals("Lunch", saved.getDescription());
    assertEquals(DATE, saved.getDate());
    verify(thresholdCheckClient).trigger(AUTH);
  }

  @Test
  void createRejectsUnknownCategoryBeforeSaving() {
    when(categoryClient.list(AUTH)).thenReturn(List.of());

    assertThrows(UnknownCategoryException.class, () -> service.create(USER_ID, request(), AUTH));

    verify(repository, never()).save(any());
    verifyNoInteractions(thresholdCheckClient);
  }

  @Test
  void getSpendDelegatesToRepositoryForCurrentMonthWindow() {
    List<SpendEntry> spend = List.of(new SpendEntry(CATEGORY_ID, new BigDecimal("24.60")));
    when(repository.findSpendByCategory(any(), any(), any())).thenReturn(spend);

    List<SpendEntry> result = service.getSpend(USER_ID);

    assertSame(spend, result);
    ArgumentCaptor<LocalDate> start = ArgumentCaptor.forClass(LocalDate.class);
    ArgumentCaptor<LocalDate> end = ArgumentCaptor.forClass(LocalDate.class);
    verify(repository).findSpendByCategory(eq(USER_ID), start.capture(), end.capture());
    assertEquals(1, start.getValue().getDayOfMonth());
    assertEquals(start.getValue().plusMonths(1), end.getValue());
  }

  @Test
  void updateChangesOwnedTransactionAndTriggersThresholdCheck() {
    UUID id = UUID.randomUUID();
    UUID newCategoryId = UUID.randomUUID();
    Transaction transaction = transaction();
    TransactionRequest request =
        new TransactionRequest(
            newCategoryId, new BigDecimal("19.95"), "EUR", "Dinner", LocalDate.of(2026, 7, 2));
    when(repository.findByIdAndUserId(id, USER_ID)).thenReturn(Optional.of(transaction));
    when(categoryClient.list(AUTH))
        .thenReturn(List.of(new CategoryClient.CategoryDto(newCategoryId, "Dining")));
    when(repository.save(any(Transaction.class))).thenAnswer(inv -> inv.getArgument(0));

    Transaction updated = service.update(USER_ID, id, request, AUTH);

    assertEquals(newCategoryId, updated.getCategoryId());
    assertEquals(new BigDecimal("19.95"), updated.getAmount());
    assertEquals("EUR", updated.getCurrency());
    assertEquals("Dinner", updated.getDescription());
    assertEquals(LocalDate.of(2026, 7, 2), updated.getDate());
    verify(thresholdCheckClient).trigger(AUTH);
  }

  @Test
  void updateRejectsMissingOrForeignTransaction() {
    UUID id = UUID.randomUUID();
    when(repository.findByIdAndUserId(id, USER_ID)).thenReturn(Optional.empty());

    assertThrows(
        TransactionNotFoundException.class, () -> service.update(USER_ID, id, request(), AUTH));

    verify(repository, never()).save(any());
    verifyNoInteractions(categoryClient, thresholdCheckClient);
  }

  @Test
  void deleteRemovesOwnedTransactionAndTriggersThresholdCheck() {
    UUID id = UUID.randomUUID();
    Transaction transaction = transaction();
    when(repository.findByIdAndUserId(id, USER_ID)).thenReturn(Optional.of(transaction));

    service.delete(USER_ID, id, AUTH);

    verify(repository).delete(transaction);
    verify(thresholdCheckClient).trigger(AUTH);
  }

  @Test
  void deleteRejectsMissingOrForeignTransaction() {
    UUID id = UUID.randomUUID();
    when(repository.findByIdAndUserId(id, USER_ID)).thenReturn(Optional.empty());

    assertThrows(TransactionNotFoundException.class, () -> service.delete(USER_ID, id, AUTH));

    verify(repository, never()).delete(any());
    verifyNoInteractions(thresholdCheckClient);
  }

  private static TransactionRequest request() {
    return new TransactionRequest(CATEGORY_ID, new BigDecimal("12.30"), "EUR", "Lunch", DATE);
  }

  private static Transaction transaction() {
    return new Transaction(USER_ID, CATEGORY_ID, new BigDecimal("12.30"), "EUR", "Lunch", DATE);
  }

  private void givenCategoryExists() {
    when(categoryClient.list(AUTH))
        .thenReturn(List.of(new CategoryClient.CategoryDto(CATEGORY_ID, "Dining")));
  }
}
