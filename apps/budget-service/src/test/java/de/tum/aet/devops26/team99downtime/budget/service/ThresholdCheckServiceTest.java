package de.tum.aet.devops26.team99downtime.budget.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.tum.aet.devops26.team99downtime.budget.domain.Category;
import de.tum.aet.devops26.team99downtime.budget.domain.ThresholdFlag;
import de.tum.aet.devops26.team99downtime.budget.dto.NotificationRequest;
import de.tum.aet.devops26.team99downtime.budget.dto.SpendEntry;
import de.tum.aet.devops26.team99downtime.budget.repository.CategoryRepository;
import de.tum.aet.devops26.team99downtime.budget.repository.ThresholdFlagRepository;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ThresholdCheckServiceTest {

  @Mock CategoryRepository categoryRepository;
  @Mock ThresholdFlagRepository thresholdFlagRepository;
  @Mock TransactionClient transactionClient;
  @Mock NotificationClient notificationClient;
  @InjectMocks ThresholdCheckService service;

  @Test
  void firesNotificationWhenThresholdFirstCrossed() {
    String userId = "user-1";
    UUID catId = UUID.randomUUID();
    Category cat = categoryWithId(userId, "Groceries", "300", catId);

    when(categoryRepository.findByUserId(userId)).thenReturn(List.of(cat));
    when(transactionClient.getSpend(any()))
        .thenReturn(List.of(new SpendEntry(catId, new BigDecimal("250.00")))); // 83%
    when(thresholdFlagRepository.existsByUserIdAndCategoryIdAndMonthAndThreshold(
            eq(userId), eq(catId), eq(YearMonth.now().toString()), eq(80)))
        .thenReturn(false);

    service.check(userId, "Bearer token");

    verify(thresholdFlagRepository).save(any(ThresholdFlag.class));
    verify(notificationClient).create(any(NotificationRequest.class), eq("Bearer token"));
  }

  @Test
  void doesNotDoubleFireSameMonthSameThreshold() {
    String userId = "user-2";
    UUID catId = UUID.randomUUID();
    Category cat = categoryWithId(userId, "Groceries", "300", catId);

    when(categoryRepository.findByUserId(userId)).thenReturn(List.of(cat));
    when(transactionClient.getSpend(any()))
        .thenReturn(List.of(new SpendEntry(catId, new BigDecimal("250.00")))); // 83%
    when(thresholdFlagRepository.existsByUserIdAndCategoryIdAndMonthAndThreshold(
            eq(userId), eq(catId), eq(YearMonth.now().toString()), eq(80)))
        .thenReturn(true);

    service.check(userId, "Bearer token");

    verify(thresholdFlagRepository, never()).save(any());
    verify(notificationClient, never()).create(any(), any());
  }

  @Test
  void doesNotFireWhenBelowThreshold() {
    String userId = "user-3";
    UUID catId = UUID.randomUUID();
    Category cat = categoryWithId(userId, "Groceries", "300", catId);

    when(categoryRepository.findByUserId(userId)).thenReturn(List.of(cat));
    when(transactionClient.getSpend(any()))
        .thenReturn(List.of(new SpendEntry(catId, new BigDecimal("50.00")))); // 17%

    service.check(userId, "Bearer token");

    verify(thresholdFlagRepository, never()).save(any());
    verify(notificationClient, never()).create(any(), any());
  }

  @Test
  void fires100PercentThresholdSeparately() {
    String userId = "user-4";
    UUID catId = UUID.randomUUID();
    Category cat = categoryWithId(userId, "Groceries", "300", catId);

    when(categoryRepository.findByUserId(userId)).thenReturn(List.of(cat));
    when(transactionClient.getSpend(any()))
        .thenReturn(List.of(new SpendEntry(catId, new BigDecimal("300.00")))); // 100%
    when(thresholdFlagRepository.existsByUserIdAndCategoryIdAndMonthAndThreshold(
            eq(userId), eq(catId), eq(YearMonth.now().toString()), eq(80)))
        .thenReturn(true); // 80% already fired
    when(thresholdFlagRepository.existsByUserIdAndCategoryIdAndMonthAndThreshold(
            eq(userId), eq(catId), eq(YearMonth.now().toString()), eq(100)))
        .thenReturn(false);

    service.check(userId, "Bearer token");

    verify(notificationClient, times(1)).create(any(NotificationRequest.class), any());
  }

  private static Category categoryWithId(String userId, String name, String limit, UUID id) {
    Category cat = new Category(userId, name, new BigDecimal(limit));
    cat.setId(id);
    return cat;
  }
}
