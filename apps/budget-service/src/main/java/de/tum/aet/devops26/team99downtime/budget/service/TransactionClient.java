package de.tum.aet.devops26.team99downtime.budget.service;

import de.tum.aet.devops26.team99downtime.budget.dto.SpendEntry;
import java.util.List;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class TransactionClient {

  private final RestClient restClient;

  public TransactionClient(@Value("${services.transaction.url}") String transactionUrl) {
    this.restClient = RestClient.builder().baseUrl(transactionUrl).build();
  }

  public List<SpendEntry> getSpend(String authHeader) {
    List<SpendEntry> result =
        restClient
            .get()
            .uri("/api/transactions/spend")
            .header(HttpHeaders.AUTHORIZATION, authHeader)
            .retrieve()
            .body(new ParameterizedTypeReference<>() {});
    return Objects.requireNonNullElse(result, List.of());
  }
}
