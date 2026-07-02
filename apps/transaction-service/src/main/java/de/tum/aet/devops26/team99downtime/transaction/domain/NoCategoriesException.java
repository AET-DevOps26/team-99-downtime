package de.tum.aet.devops26.team99downtime.transaction.domain;

/**
 * Free-text entry needs at least one category to file expenses into — the AI only ever picks from
 * the user's existing categories, it never invents budgets.
 */
public class NoCategoriesException extends RuntimeException {

  public NoCategoriesException() {
    super("Create at least one category before adding expenses by text");
  }
}
