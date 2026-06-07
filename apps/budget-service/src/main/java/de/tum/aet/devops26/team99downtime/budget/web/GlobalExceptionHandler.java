package de.tum.aet.devops26.team99downtime.budget.web;

import de.tum.aet.devops26.team99downtime.budget.domain.CategoryNotFoundException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Translates the failure modes the category API cares about into HTTP status codes:
 *
 * <ul>
 *   <li>bean-validation failures (e.g. blank name, limit ≤ 0) → 400 with per-field messages, so the
 *       frontend can surface them inline;
 *   <li>a missing or non-owned category → 404;
 *   <li>the unique {@code (user_id, name)} constraint tripping → 409, i.e. a duplicate category
 *       name for that user.
 * </ul>
 */
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

  @ExceptionHandler(CategoryNotFoundException.class)
  public ResponseEntity<Map<String, Object>> handleNotFound(CategoryNotFoundException ex) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("error", "category_not_found");
    body.put("message", ex.getMessage());
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<Map<String, Object>> handleDuplicate(DataIntegrityViolationException ex) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("error", "duplicate_category");
    body.put("message", "A category with this name already exists.");
    return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
  }
}
