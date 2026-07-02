package de.tum.aet.devops26.team99downtime.transaction.domain;

import java.util.UUID;

/**
 * A transaction referenced a category the user does not own. Category ids come from the client, so
 * a stale or hand-crafted id must be rejected rather than persisted against a non-existent budget.
 */
public class UnknownCategoryException extends RuntimeException {

  public UnknownCategoryException(UUID categoryId) {
    super("Unknown category: " + categoryId);
  }
}
