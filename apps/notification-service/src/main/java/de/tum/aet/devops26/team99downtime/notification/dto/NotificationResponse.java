package de.tum.aet.devops26.team99downtime.notification.dto;

import de.tum.aet.devops26.team99downtime.notification.domain.Notification;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record NotificationResponse(
    UUID id,
    UUID categoryId,
    String categoryName,
    int threshold,
    BigDecimal percentUsed,
    BigDecimal amountLeft,
    LocalDateTime createdAt,
    LocalDateTime readAt) {

  public static NotificationResponse from(Notification n) {
    return new NotificationResponse(
        n.getId(),
        n.getCategoryId(),
        n.getCategoryName(),
        n.getThreshold(),
        n.getPercentUsed(),
        n.getAmountLeft(),
        n.getCreatedAt(),
        n.getReadAt());
  }
}
