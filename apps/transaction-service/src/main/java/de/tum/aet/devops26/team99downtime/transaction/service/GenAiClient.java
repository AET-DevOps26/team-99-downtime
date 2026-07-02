package de.tum.aet.devops26.team99downtime.transaction.service;

import de.tum.aet.devops26.team99downtime.transaction.domain.FreeTextTooVagueException;
import de.tum.aet.devops26.team99downtime.transaction.domain.InvalidFileException;
import de.tum.aet.devops26.team99downtime.transaction.domain.UpstreamServiceException;
import de.tum.aet.devops26.team99downtime.transaction.dto.SkippedRow;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.function.Supplier;
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
    CategorizeResponse response =
        post(
            "/api/genai/categorize",
            new CategorizeRequest(text, categoryNames),
            authHeader,
            CategorizeResponse.class,
            FreeTextTooVagueException::new);
    if (response == null || response.expenses() == null || response.expenses().isEmpty()) {
      throw new FreeTextTooVagueException();
    }
    return response.expenses();
  }

  /** Parses a bank CSV or free-text notes file; a 422 from genai means "no expense data". */
  public FileParseResult parseFile(String content, List<String> categoryNames, String authHeader) {
    FileParseResult result =
        post(
            "/api/genai/parse-file",
            new ParseFileRequest(content, categoryNames),
            authHeader,
            FileParseResult.class,
            () -> new InvalidFileException("The file could not be read as expenses"));
    if (result == null || result.expenses() == null || result.skipped() == null) {
      throw new UpstreamServiceException("genai-service returned an empty file parse result");
    }
    return result;
  }

  /** POSTs to genai forwarding the bearer token; 422 maps to the endpoint's contract exception. */
  private <T> T post(
      String uri,
      Object body,
      String authHeader,
      Class<T> responseType,
      Supplier<RuntimeException> onUnprocessable) {
    try {
      return restClient
          .post()
          .uri(uri)
          .header(HttpHeaders.AUTHORIZATION, authHeader)
          .contentType(MediaType.APPLICATION_JSON)
          .body(body)
          .retrieve()
          .body(responseType);
    } catch (HttpClientErrorException.UnprocessableEntity e) {
      throw onUnprocessable.get();
    } catch (RestClientException e) {
      throw new UpstreamServiceException("genai-service call failed", e);
    }
  }

  record CategorizeRequest(String text, List<String> categories) {}

  record CategorizeResponse(List<CategorizedExpense> expenses) {}

  record ParseFileRequest(String content, List<String> categories) {}

  /** One expense as extracted by the AI; category is a name from the list we sent. */
  public record CategorizedExpense(
      BigDecimal amount, String currency, String merchant, String category, LocalDate date) {}

  /** One expense extracted from a file row/line ({@code row} is the 1-based line number). */
  public record RowExpense(
      int row,
      BigDecimal amount,
      String currency,
      String merchant,
      String category,
      LocalDate date) {}

  public record FileParseResult(List<RowExpense> expenses, List<SkippedRow> skipped) {}
}
