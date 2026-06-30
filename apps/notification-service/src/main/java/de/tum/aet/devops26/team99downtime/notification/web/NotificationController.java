package de.tum.aet.devops26.team99downtime.notification.web;

import de.tum.aet.devops26.team99downtime.notification.dto.NotificationCreateRequest;
import de.tum.aet.devops26.team99downtime.notification.dto.NotificationResponse;
import de.tum.aet.devops26.team99downtime.notification.service.NotificationService;
import de.tum.aet.devops26.team99downtime.notification.service.NotificationStreamService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

  private final NotificationService service;
  private final NotificationStreamService streamService;

  public NotificationController(
      NotificationService service, NotificationStreamService streamService) {
    this.service = service;
    this.streamService = streamService;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public NotificationResponse create(
      @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody NotificationCreateRequest request) {
    return NotificationResponse.from(service.create(jwt.getSubject(), request));
  }

  @GetMapping
  public List<NotificationResponse> list(@AuthenticationPrincipal Jwt jwt) {
    return service.listForUser(jwt.getSubject()).stream().map(NotificationResponse::from).toList();
  }

  @PatchMapping("/{id}/read")
  public NotificationResponse markAsRead(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    return NotificationResponse.from(service.markAsRead(jwt.getSubject(), id));
  }

  @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public SseEmitter stream(@AuthenticationPrincipal Jwt jwt) {
    return streamService.subscribe(jwt.getSubject());
  }
}
