package de.tum.aet.devops26.team99downtime.budget.domain;

/**
 * Raised when a category does not exist for the requesting user — either it never existed or it
 * belongs to someone else. A plain domain exception so the service layer carries no web concerns;
 * {@code GlobalExceptionHandler} maps it to a 404.
 */
public class CategoryNotFoundException extends RuntimeException {

  public CategoryNotFoundException() {
    super("Category not found");
  }
}
