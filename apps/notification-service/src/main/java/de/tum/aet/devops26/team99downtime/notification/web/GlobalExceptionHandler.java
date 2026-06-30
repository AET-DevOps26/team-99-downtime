package de.tum.aet.devops26.team99downtime.notification.web;

import de.tum.aet.devops26.team99downtime.notification.domain.NotificationNotFoundException;
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

  @ExceptionHandler(NotificationNotFoundException.class)
  public ResponseEntity<Map<String, Object>> handleNotFound(NotificationNotFoundException ex) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("error", "notification_not_found");
    body.put("message", ex.getMessage());
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
  }
}
