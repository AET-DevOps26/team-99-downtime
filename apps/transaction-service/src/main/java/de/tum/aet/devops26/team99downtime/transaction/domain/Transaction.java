package de.tum.aet.devops26.team99downtime.transaction.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "transactions")
@Getter
@Setter
@NoArgsConstructor
public class Transaction {

  @Id @GeneratedValue private UUID id;

  @Column(nullable = false)
  private String userId;

  @Column(nullable = false)
  private UUID categoryId;

  @Column(nullable = false, precision = 12, scale = 2)
  private BigDecimal amount;

  @Column(nullable = false)
  private String currency;

  @Column(nullable = false)
  private String description;

  @Column(nullable = false)
  private LocalDate date;

  @Column(nullable = false)
  private LocalDateTime createdAt;

  @PrePersist
  void onCreate() {
    this.createdAt = LocalDateTime.now();
  }

  public Transaction(
      String userId,
      UUID categoryId,
      BigDecimal amount,
      String currency,
      String description,
      LocalDate date) {
    this.userId = userId;
    this.categoryId = categoryId;
    this.amount = amount;
    this.currency = currency;
    this.description = description;
    this.date = date;
  }
}
