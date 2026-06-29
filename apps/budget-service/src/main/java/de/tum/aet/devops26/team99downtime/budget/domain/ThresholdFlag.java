package de.tum.aet.devops26.team99downtime.budget.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
    name = "threshold_flags",
    uniqueConstraints =
        @UniqueConstraint(columnNames = {"user_id", "category_id", "month", "threshold"}))
@Getter
@NoArgsConstructor
public class ThresholdFlag {

  @Id @GeneratedValue private UUID id;

  @Column(nullable = false)
  private String userId;

  @Column(nullable = false)
  private UUID categoryId;

  @Column(nullable = false)
  private String month;

  @Column(nullable = false)
  private int threshold;

  @Column(nullable = false)
  private LocalDateTime firedAt;

  public ThresholdFlag(String userId, UUID categoryId, String month, int threshold) {
    this.userId = userId;
    this.categoryId = categoryId;
    this.month = month;
    this.threshold = threshold;
    this.firedAt = LocalDateTime.now();
  }
}
