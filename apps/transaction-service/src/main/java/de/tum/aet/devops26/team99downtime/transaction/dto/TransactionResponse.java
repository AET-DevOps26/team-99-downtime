package de.tum.aet.devops26.team99downtime.transaction.dto;

import de.tum.aet.devops26.team99downtime.transaction.domain.Transaction;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record TransactionResponse(
    UUID id,
    UUID categoryId,
    BigDecimal amount,
    String currency,
    String description,
    LocalDate date,
    LocalDateTime createdAt) {

  public static TransactionResponse from(Transaction t) {
    return new TransactionResponse(
        t.getId(),
        t.getCategoryId(),
        t.getAmount(),
        t.getCurrency(),
        t.getDescription(),
        t.getDate(),
        t.getCreatedAt());
  }
}
