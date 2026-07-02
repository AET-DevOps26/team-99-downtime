package de.tum.aet.devops26.team99downtime.transaction.domain;

/** The uploaded file is not a readable expense file (wrong type, empty, binary, or too large). */
public class InvalidFileException extends RuntimeException {

  public InvalidFileException(String message) {
    super(message);
  }
}
