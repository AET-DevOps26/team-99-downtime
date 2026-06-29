package de.tum.aet.devops26.team99downtime.notification.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
public class Notification {

  @Id @GeneratedValue private UUID id;

  @Column(nullable = false)
  private String userId;

  @Column(nullable = false)
  private UUID categoryId;

  @Column(nullable = false)
  private String categoryName;

  @Column(nullable = false)
  private int threshold;

  @Column(nullable = false, precision = 12, scale = 2)
  private BigDecimal percentUsed;

  @Column(nullable = false, precision = 12, scale = 2)
  private BigDecimal amountLeft;

  @Column(nullable = false)
  private LocalDateTime createdAt;

  @Column private LocalDateTime readAt;

  public Notification(
      String userId,
      UUID categoryId,
      String categoryName,
      int threshold,
      BigDecimal percentUsed,
      BigDecimal amountLeft) {
    this.userId = userId;
    this.categoryId = categoryId;
    this.categoryName = categoryName;
    this.threshold = threshold;
    this.percentUsed = percentUsed;
    this.amountLeft = amountLeft;
    this.createdAt = LocalDateTime.now();
  }
}
