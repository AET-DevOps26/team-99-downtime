package de.tum.aet.devops26.team99downtime.budget.repository;

import de.tum.aet.devops26.team99downtime.budget.domain.ThresholdFlag;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ThresholdFlagRepository extends JpaRepository<ThresholdFlag, UUID> {

  boolean existsByUserIdAndCategoryIdAndMonthAndThreshold(
      String userId, UUID categoryId, String month, int threshold);
}
