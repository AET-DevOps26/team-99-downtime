package de.tum.aet.devops26.team99downtime.budget.service;

import de.tum.aet.devops26.team99downtime.budget.domain.Category;
import de.tum.aet.devops26.team99downtime.budget.domain.ThresholdFlag;
import de.tum.aet.devops26.team99downtime.budget.dto.NotificationRequest;
import de.tum.aet.devops26.team99downtime.budget.dto.SpendEntry;
import de.tum.aet.devops26.team99downtime.budget.repository.CategoryRepository;
import de.tum.aet.devops26.team99downtime.budget.repository.ThresholdFlagRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
public class ThresholdCheckService {

  private static final List<Integer> THRESHOLDS = List.of(80, 100);

  private final CategoryRepository categoryRepository;
  private final ThresholdFlagRepository thresholdFlagRepository;
  private final TransactionClient transactionClient;
  private final NotificationClient notificationClient;

  public ThresholdCheckService(
      CategoryRepository categoryRepository,
      ThresholdFlagRepository thresholdFlagRepository,
      TransactionClient transactionClient,
      NotificationClient notificationClient) {
    this.categoryRepository = categoryRepository;
    this.thresholdFlagRepository = thresholdFlagRepository;
    this.transactionClient = transactionClient;
    this.notificationClient = notificationClient;
  }

  public void check(String userId, String authHeader) {
    List<Category> categories = categoryRepository.findByUserId(userId);
    Map<UUID, BigDecimal> spendMap =
        transactionClient.getSpend(authHeader).stream()
            .collect(Collectors.toMap(SpendEntry::categoryId, SpendEntry::totalSpent));

    String currentMonth = YearMonth.now().toString();

    for (Category cat : categories) {
      if (cat.getMonthlyLimit().compareTo(BigDecimal.ZERO) == 0) continue;
      BigDecimal spent = spendMap.getOrDefault(cat.getId(), BigDecimal.ZERO);
      BigDecimal percent =
          spent
              .divide(cat.getMonthlyLimit(), 4, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100));

      // Record a flag for every threshold crossed this month, but notify only for
      // the highest newly-crossed one: a jump straight to 100% sends a single
      // 100% alert, not both 80% and 100%.
      int highestNew = -1;
      for (int threshold : THRESHOLDS) {
        if (percent.compareTo(BigDecimal.valueOf(threshold)) < 0) continue;
        if (thresholdFlagRepository.existsByUserIdAndCategoryIdAndMonthAndThreshold(
            userId, cat.getId(), currentMonth, threshold)) continue;

        try {
          thresholdFlagRepository.save(
              new ThresholdFlag(userId, cat.getId(), currentMonth, threshold));
        } catch (DataIntegrityViolationException e) {
          continue; // concurrent request already recorded it — skip
        }
        highestNew = Math.max(highestNew, threshold);
      }

      if (highestNew != -1) {
        notificationClient.create(
            new NotificationRequest(
                cat.getId(),
                cat.getName(),
                highestNew,
                percent.setScale(2, RoundingMode.HALF_UP),
                cat.getMonthlyLimit().subtract(spent)),
            authHeader);
      }
    }
  }
}
