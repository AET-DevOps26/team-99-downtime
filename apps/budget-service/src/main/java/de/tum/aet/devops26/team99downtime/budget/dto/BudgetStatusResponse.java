package de.tum.aet.devops26.team99downtime.budget.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record BudgetStatusResponse(
    UUID categoryId,
    String name,
    BigDecimal monthlyLimit,
    BigDecimal spent,
    BigDecimal remaining,
    BigDecimal percentUsed) {}
