package de.tum.aet.devops26.team99downtime.budget.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

/**
 * Payload for creating or updating a category. {@code @Positive} rejects a zero or negative limit
 * with a 400 (see US-1: "reject limit ≤ 0"); the unique-name 409 is enforced at the database level,
 * not here.
 */
public record CategoryRequest(@NotBlank String name, @NotNull @Positive BigDecimal monthlyLimit) {}
