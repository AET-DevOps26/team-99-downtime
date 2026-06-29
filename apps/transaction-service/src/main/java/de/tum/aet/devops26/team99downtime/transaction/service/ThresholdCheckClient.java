package de.tum.aet.devops26.team99downtime.transaction.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class ThresholdCheckClient {

  private static final Logger LOG = LoggerFactory.getLogger(ThresholdCheckClient.class);

  private final RestClient restClient;

  public ThresholdCheckClient(@Value("${services.budget.url}") String budgetUrl) {
    this.restClient = RestClient.builder().baseUrl(budgetUrl).build();
  }

  @Async
  public void trigger(String authHeader) {
    if (authHeader == null) {
      LOG.warn("Threshold check skipped: no Authorization header");
      return;
    }
    try {
      restClient
          .post()
          .uri("/api/budgets/threshold-check")
          .header(HttpHeaders.AUTHORIZATION, authHeader)
          .retrieve()
          .toBodilessEntity();
    } catch (Exception e) {
      LOG.warn("Threshold check failed (fire-and-forget): {}", e.getMessage());
    }
  }
}
