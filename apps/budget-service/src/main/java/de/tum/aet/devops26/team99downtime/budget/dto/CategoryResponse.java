package de.tum.aet.devops26.team99downtime.budget.dto;

import de.tum.aet.devops26.team99downtime.budget.domain.Category;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * What the API returns for a category. Deliberately omits {@code userId}: the caller is always the
 * owner, so exposing it would be noise.
 */
public record CategoryResponse(UUID id, String name, BigDecimal monthlyLimit) {

  public static CategoryResponse from(Category category) {
    return new CategoryResponse(category.getId(), category.getName(), category.getMonthlyLimit());
  }
}
