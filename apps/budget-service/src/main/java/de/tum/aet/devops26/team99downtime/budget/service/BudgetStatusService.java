package de.tum.aet.devops26.team99downtime.budget.service;

import de.tum.aet.devops26.team99downtime.budget.domain.Category;
import de.tum.aet.devops26.team99downtime.budget.dto.BudgetStatusResponse;
import de.tum.aet.devops26.team99downtime.budget.dto.SpendEntry;
import de.tum.aet.devops26.team99downtime.budget.repository.CategoryRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class BudgetStatusService {

  private final CategoryRepository categoryRepository;
  private final TransactionClient transactionClient;

  public BudgetStatusService(
      CategoryRepository categoryRepository, TransactionClient transactionClient) {
    this.categoryRepository = categoryRepository;
    this.transactionClient = transactionClient;
  }

  public List<BudgetStatusResponse> getStatus(String userId, String authHeader) {
    List<Category> categories = categoryRepository.findByUserId(userId);
    Map<UUID, BigDecimal> spendMap =
        transactionClient.getSpend(authHeader).stream()
            .collect(Collectors.toMap(SpendEntry::categoryId, SpendEntry::totalSpent));

    return categories.stream()
        .map(
            cat -> {
              BigDecimal spent = spendMap.getOrDefault(cat.getId(), BigDecimal.ZERO);
              BigDecimal remaining = cat.getMonthlyLimit().subtract(spent);
              BigDecimal percent =
                  cat.getMonthlyLimit().compareTo(BigDecimal.ZERO) == 0
                      ? BigDecimal.ZERO
                      : spent
                          .divide(cat.getMonthlyLimit(), 4, RoundingMode.HALF_UP)
                          .multiply(BigDecimal.valueOf(100))
                          .setScale(2, RoundingMode.HALF_UP);
              return new BudgetStatusResponse(
                  cat.getId(), cat.getName(), cat.getMonthlyLimit(), spent, remaining, percent);
            })
        .toList();
  }
}
