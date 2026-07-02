package de.tum.aet.devops26.team99downtime.transaction.domain;

/** The AI service could not extract an expense from the sentence (422 upstream). */
public class FreeTextTooVagueException extends RuntimeException {

  public FreeTextTooVagueException() {
    super("The sentence is too vague to extract an expense from");
  }
}
