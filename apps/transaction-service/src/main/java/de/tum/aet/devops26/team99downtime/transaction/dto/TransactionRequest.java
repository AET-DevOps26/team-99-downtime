package de.tum.aet.devops26.team99downtime.transaction.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record TransactionRequest(
    @NotNull UUID categoryId,
    @NotNull @Positive BigDecimal amount,
    @NotBlank String currency,
    @NotBlank String description,
    @NotNull LocalDate date) {}
