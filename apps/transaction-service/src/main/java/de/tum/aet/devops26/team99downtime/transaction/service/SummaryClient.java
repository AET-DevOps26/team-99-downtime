package de.tum.aet.devops26.team99downtime.transaction.service;

import de.tum.aet.devops26.team99downtime.transaction.dto.WeeklyReport;
import java.time.LocalDate;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

/**
 * Posts one user's {@link WeeklyReport} to the genai-service so it generates and stores that user's
 * weekly summary. Unlike {@link GenAiClient} this targets the *internal* route: the caller is the
 * weekly scheduler, which acts for many users at once, so no user JWT exists to forward. The route
 * is only reachable inside the compose/cluster network — the gateway routes just /api/genai* to the
 * service.
 */
@Service
public class SummaryClient {

  private final RestClient restClient;

  // The auto-configured builder (not RestClient.builder()) so the Boot ObjectMapper
  // serializes LocalDate as "2026-06-29" — the raw default writes date arrays,
  // which genai's validation rejects.
  public SummaryClient(
      RestClient.Builder builder, @Value("${services.genai.url}") String genaiUrl) {
    this.restClient = builder.baseUrl(genaiUrl).build();
  }

  /**
   * Returns true when a summary was generated, false when genai declined for lack of data (its 422
   * NOT_ENOUGH_DATA contract — expected for sparse weeks, not an error). Any other 422 is a broken
   * payload and stays an error.
   */
  public boolean summarize(String userId, WeeklyReport report) {
    try {
      restClient
          .post()
          .uri("/internal/summarize")
          .contentType(MediaType.APPLICATION_JSON)
          .body(
              new InternalSummarizeRequest(
                  userId, report.weekStart(), report.thisWeek(), report.lastWeek()))
          .retrieve()
          .toBodilessEntity();
      return true;
    } catch (HttpClientErrorException.UnprocessableEntity e) {
      if (e.getResponseBodyAsString().contains("NOT_ENOUGH_DATA")) {
        return false;
      }
      throw e;
    }
  }

  record InternalSummarizeRequest(
      String userId,
      LocalDate weekStart,
      List<WeeklyReport.Entry> thisWeek,
      WeeklyReport.LastWeek lastWeek) {}
}
