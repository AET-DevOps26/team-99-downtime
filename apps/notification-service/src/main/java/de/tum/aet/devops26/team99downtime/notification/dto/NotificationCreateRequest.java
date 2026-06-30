package de.tum.aet.devops26.team99downtime.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record NotificationCreateRequest(
    @NotNull UUID categoryId,
    @NotBlank String categoryName,
    int threshold,
    @NotNull BigDecimal percentUsed,
    @NotNull BigDecimal amountLeft) {}
