package de.tum.aet.devops26.team99downtime.budget.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record SpendEntry(UUID categoryId, BigDecimal totalSpent) {}
