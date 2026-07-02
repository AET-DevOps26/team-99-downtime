package de.tum.aet.devops26.team99downtime.transaction.domain;

/** The uploaded file is not a readable CSV (wrong type, empty, binary, or too large). */
public class InvalidCsvException extends RuntimeException {

  public InvalidCsvException(String message) {
    super(message);
  }
}
