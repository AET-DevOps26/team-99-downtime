package de.tum.aet.devops26.team99downtime.budget.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A spending category owned by a single user, with a monthly limit to track spend against. The
 * {@code userId} is the JWT subject ({@code sub}) of the owning user — categories are never shared
 * across users.
 *
 * <p>The unique constraint on {@code (userId, name)} enforces "no duplicate category names per
 * user" at the database level, which the controller surfaces as a 409.
 */
@Entity
@Table(
    name = "categories",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "name"}))
@Getter
@Setter
@NoArgsConstructor
public class Category {

  @Id @GeneratedValue private UUID id;

  @Column(nullable = false)
  private String userId;

  @Column(nullable = false)
  private String name;

  @Column(nullable = false, precision = 12, scale = 2)
  private BigDecimal monthlyLimit;

  public Category(String userId, String name, BigDecimal monthlyLimit) {
    this.userId = userId;
    this.name = name;
    this.monthlyLimit = monthlyLimit;
  }
}
