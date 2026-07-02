package de.tum.aet.devops26.team99downtime.transaction.service;

import de.tum.aet.devops26.team99downtime.transaction.domain.FreeTextTooVagueException;
import de.tum.aet.devops26.team99downtime.transaction.domain.UpstreamServiceException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Calls the genai-service to turn a free-text sentence into structured expenses. The caller's
 * bearer token is forwarded, mirroring {@link ThresholdCheckClient}; a 422 from genai is the "too
 * vague" contract.
 */
@Service
public class GenAiClient {

  private final RestClient restClient;

  public GenAiClient(@Value("${services.genai.url}") String genaiUrl) {
    this.restClient = RestClient.builder().baseUrl(genaiUrl).build();
  }

  public List<CategorizedExpense> categorize(
      String text, List<String> categoryNames, String authHeader) {
    CategorizeResponse response;
    try {
      response =
          restClient
              .post()
              .uri("/api/genai/categorize")
              .header(HttpHeaders.AUTHORIZATION, authHeader)
              .contentType(MediaType.APPLICATION_JSON)
              .body(new CategorizeRequest(text, categoryNames))
              .retrieve()
              .body(CategorizeResponse.class);
    } catch (HttpClientErrorException.UnprocessableEntity e) {
      throw new FreeTextTooVagueException();
    } catch (RestClientException e) {
      throw new UpstreamServiceException("genai-service call failed", e);
    }
    if (response == null || response.expenses() == null || response.expenses().isEmpty()) {
      throw new FreeTextTooVagueException();
    }
    return response.expenses();
  }

  record CategorizeRequest(String text, List<String> categories) {}

  record CategorizeResponse(List<CategorizedExpense> expenses) {}

  /** One expense as extracted by the AI; category is a name from the list we sent. */
  public record CategorizedExpense(
      BigDecimal amount, String currency, String merchant, String category, LocalDate date) {}
}
