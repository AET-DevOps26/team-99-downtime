package de.tum.aet.devops26.team99downtime.transaction.web;

import de.tum.aet.devops26.team99downtime.transaction.domain.FreeTextTooVagueException;
import de.tum.aet.devops26.team99downtime.transaction.domain.InvalidCsvException;
import de.tum.aet.devops26.team99downtime.transaction.domain.NoCategoriesException;
import de.tum.aet.devops26.team99downtime.transaction.domain.TransactionNotFoundException;
import de.tum.aet.devops26.team99downtime.transaction.domain.UpstreamServiceException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
    Map<String, String> fieldErrors = new LinkedHashMap<>();
    for (FieldError error : ex.getBindingResult().getFieldErrors()) {
      fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage());
    }
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("error", "validation_failed");
    body.put("fields", fieldErrors);
    return ResponseEntity.badRequest().body(body);
  }

  @ExceptionHandler(TransactionNotFoundException.class)
  public ResponseEntity<Map<String, Object>> handleNotFound(TransactionNotFoundException ex) {
    return error(HttpStatus.NOT_FOUND, "transaction_not_found", ex.getMessage());
  }

  // Free-text entry: "too vague" / "no categories" are client-fixable (422),
  // a failing genai- or budget-service is not (502).
  @ExceptionHandler(FreeTextTooVagueException.class)
  public ResponseEntity<Map<String, Object>> handleTooVague(FreeTextTooVagueException ex) {
    return error(HttpStatus.UNPROCESSABLE_ENTITY, "too_vague", ex.getMessage());
  }

  @ExceptionHandler(NoCategoriesException.class)
  public ResponseEntity<Map<String, Object>> handleNoCategories(NoCategoriesException ex) {
    return error(HttpStatus.UNPROCESSABLE_ENTITY, "no_categories", ex.getMessage());
  }

  @ExceptionHandler(InvalidCsvException.class)
  public ResponseEntity<Map<String, Object>> handleInvalidCsv(InvalidCsvException ex) {
    return error(HttpStatus.UNPROCESSABLE_ENTITY, "invalid_csv", ex.getMessage());
  }

  @ExceptionHandler(UpstreamServiceException.class)
  public ResponseEntity<Map<String, Object>> handleUpstream(UpstreamServiceException ex) {
    return error(HttpStatus.BAD_GATEWAY, "upstream_unavailable", ex.getMessage());
  }

  private static ResponseEntity<Map<String, Object>> error(
      HttpStatus status, String error, String message) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("error", error);
    body.put("message", message);
    return ResponseEntity.status(status).body(body);
  }
}
