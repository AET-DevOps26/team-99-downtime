package de.tum.aet.devops26.team99downtime.transaction.domain;

public class TransactionNotFoundException extends RuntimeException {
  public TransactionNotFoundException() {
    super("Transaction not found");
  }
}
