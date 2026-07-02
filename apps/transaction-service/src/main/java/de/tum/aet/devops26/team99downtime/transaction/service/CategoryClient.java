package de.tum.aet.devops26.team99downtime.transaction.service;

import de.tum.aet.devops26.team99downtime.transaction.domain.UpstreamServiceException;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Fetches the caller's categories from the budget-service (the category owner) so free-text
 * expenses can be filed into an existing category by name. Forwards the caller's bearer token like
 * {@link ThresholdCheckClient}.
 */
@Service
public class CategoryClient {

  private final RestClient restClient;

  public CategoryClient(@Value("${services.budget.url}") String budgetUrl) {
    this.restClient = RestClient.builder().baseUrl(budgetUrl).build();
  }

  public List<CategoryDto> list(String authHeader) {
    try {
      List<CategoryDto> categories =
          restClient
              .get()
              .uri("/api/budgets/categories")
              .header(HttpHeaders.AUTHORIZATION, authHeader)
              .retrieve()
              .body(new ParameterizedTypeReference<>() {});
      return categories == null ? List.of() : categories;
    } catch (RestClientException e) {
      throw new UpstreamServiceException("budget-service category lookup failed", e);
    }
  }

  public record CategoryDto(UUID id, String name) {}
}
