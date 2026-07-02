package de.tum.aet.devops26.team99downtime.transaction.domain;

/** A dependency (genai- or budget-service) failed or answered out of contract (502 to caller). */
public class UpstreamServiceException extends RuntimeException {

  public UpstreamServiceException(String message) {
    super(message);
  }

  public UpstreamServiceException(String message, Throwable cause) {
    super(message, cause);
  }
}
