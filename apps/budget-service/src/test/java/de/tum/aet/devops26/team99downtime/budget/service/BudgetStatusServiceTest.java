package de.tum.aet.devops26.team99downtime.budget.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import de.tum.aet.devops26.team99downtime.budget.domain.Category;
import de.tum.aet.devops26.team99downtime.budget.dto.BudgetStatusResponse;
import de.tum.aet.devops26.team99downtime.budget.dto.SpendEntry;
import de.tum.aet.devops26.team99downtime.budget.repository.CategoryRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class BudgetStatusServiceTest {

  @Mock CategoryRepository categoryRepository;
  @Mock TransactionClient transactionClient;
  @InjectMocks BudgetStatusService service;

  @Test
  void computesSpentRemainingAndPercentForPartialSpend() {
    UUID catId = UUID.randomUUID();
    Category cat = categoryWithId("user-1", "Groceries", "300.00", catId);

    when(categoryRepository.findByUserId("user-1")).thenReturn(List.of(cat));
    when(transactionClient.getSpend(any()))
        .thenReturn(List.of(new SpendEntry(catId, new BigDecimal("240.00"))));

    List<BudgetStatusResponse> result = service.getStatus("user-1", "Bearer token");

    assertThat(result).hasSize(1);
    BudgetStatusResponse r = result.get(0);
    assertThat(r.categoryId()).isEqualTo(catId);
    assertThat(r.spent()).isEqualByComparingTo("240.00");
    assertThat(r.remaining()).isEqualByComparingTo("60.00");
    assertThat(r.percentUsed()).isEqualByComparingTo("80.00");
  }

  @Test
  void returnsZeroSpendWhenCategoryAbsentFromSpendMap() {
    UUID catId = UUID.randomUUID();
    Category cat = categoryWithId("user-2", "Utilities", "100.00", catId);

    when(categoryRepository.findByUserId("user-2")).thenReturn(List.of(cat));
    when(transactionClient.getSpend(any())).thenReturn(List.of());

    BudgetStatusResponse r = service.getStatus("user-2", "Bearer token").get(0);

    assertThat(r.spent()).isEqualByComparingTo("0.00");
    assertThat(r.remaining()).isEqualByComparingTo("100.00");
    assertThat(r.percentUsed()).isEqualByComparingTo("0.00");
  }

  @Test
  void returnsZeroPercentForZeroLimitCategory() {
    UUID catId = UUID.randomUUID();
    Category cat = categoryWithId("user-3", "Misc", "0.00", catId);

    when(categoryRepository.findByUserId("user-3")).thenReturn(List.of(cat));
    when(transactionClient.getSpend(any()))
        .thenReturn(List.of(new SpendEntry(catId, new BigDecimal("50.00"))));

    BudgetStatusResponse r = service.getStatus("user-3", "Bearer token").get(0);

    assertThat(r.percentUsed()).isEqualByComparingTo("0.00");
  }

  @Test
  void returnsNegativeRemainingWhenOverBudget() {
    UUID catId = UUID.randomUUID();
    Category cat = categoryWithId("user-4", "Dining Out", "200.00", catId);

    when(categoryRepository.findByUserId("user-4")).thenReturn(List.of(cat));
    when(transactionClient.getSpend(any()))
        .thenReturn(List.of(new SpendEntry(catId, new BigDecimal("250.00"))));

    BudgetStatusResponse r = service.getStatus("user-4", "Bearer token").get(0);

    assertThat(r.remaining()).isEqualByComparingTo("-50.00");
    assertThat(r.percentUsed()).isEqualByComparingTo("125.00");
  }

  @Test
  void handlesMixedSpendAcrossMultipleCategories() {
    UUID cat1Id = UUID.randomUUID();
    UUID cat2Id = UUID.randomUUID();
    Category cat1 = categoryWithId("user-5", "Groceries", "300.00", cat1Id);
    Category cat2 = categoryWithId("user-5", "Transport", "100.00", cat2Id);

    when(categoryRepository.findByUserId("user-5")).thenReturn(List.of(cat1, cat2));
    when(transactionClient.getSpend(any()))
        .thenReturn(List.of(new SpendEntry(cat1Id, new BigDecimal("150.00"))));

    List<BudgetStatusResponse> results = service.getStatus("user-5", "Bearer token");

    BudgetStatusResponse groceries =
        results.stream().filter(r -> r.categoryId().equals(cat1Id)).findFirst().orElseThrow();
    BudgetStatusResponse transport =
        results.stream().filter(r -> r.categoryId().equals(cat2Id)).findFirst().orElseThrow();

    assertThat(groceries.spent()).isEqualByComparingTo("150.00");
    assertThat(groceries.percentUsed()).isEqualByComparingTo("50.00");
    assertThat(transport.spent()).isEqualByComparingTo("0.00");
    assertThat(transport.remaining()).isEqualByComparingTo("100.00");
  }

  private static Category categoryWithId(String userId, String name, String limit, UUID id) {
    Category cat = new Category(userId, name, new BigDecimal(limit));
    cat.setId(id);
    return cat;
  }
}
