package de.tum.aet.devops26.team99downtime.transaction.domain;

/** The file was readable but not a single expense could be recognized in it. */
public class NoExpensesException extends RuntimeException {

  public NoExpensesException() {
    super("No expenses could be recognized in that file");
  }
}
