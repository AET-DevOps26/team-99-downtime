package de.tum.aet.devops26.team99downtime.budget.service;

import de.tum.aet.devops26.team99downtime.budget.dto.NotificationRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class NotificationClient {

  private static final Logger LOG = LoggerFactory.getLogger(NotificationClient.class);

  private final RestClient restClient;

  public NotificationClient(@Value("${services.notification.url}") String notificationUrl) {
    this.restClient = RestClient.builder().baseUrl(notificationUrl).build();
  }

  public void create(NotificationRequest request, String authHeader) {
    try {
      restClient
          .post()
          .uri("/api/notifications")
          .header(HttpHeaders.AUTHORIZATION, authHeader)
          .body(request)
          .retrieve()
          .toBodilessEntity();
    } catch (Exception e) {
      LOG.warn("Failed to create notification (non-critical): {}", e.getMessage());
    }
  }
}
