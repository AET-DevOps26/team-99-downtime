package de.tum.aet.devops26.team99downtime.transaction.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import de.tum.aet.devops26.team99downtime.transaction.dto.WeeklyReport;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.client.RestClientTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.HttpClientErrorException;

/**
 * Wire-format contract of the internal summarize call. The dates MUST serialize as ISO strings — a
 * raw default ObjectMapper writes LocalDate as [2026,6,29], which genai's validation rejects
 * (regression: that surfaced as every user being "skipped").
 */
@RestClientTest(SummaryClient.class)
@TestPropertySource(properties = "services.genai.url=http://genai-test")
class SummaryClientTest {

  @Autowired private SummaryClient client;
  @Autowired private MockRestServiceServer server;

  private static WeeklyReport report() {
    return new WeeklyReport(
        LocalDate.of(2026, 6, 29),
        List.of(
            new WeeklyReport.Entry(
                LocalDate.of(2026, 7, 1), new BigDecimal("8.50"), "EUR", "Mensa")),
        new WeeklyReport.LastWeek(new BigDecimal("41.20"), 4));
  }

  @Test
  void postsIsoDatesAndTheTargetUser() {
    server
        .expect(requestTo("http://genai-test/internal/summarize"))
        .andExpect(jsonPath("$.userId").value("user-1"))
        .andExpect(jsonPath("$.weekStart").value("2026-06-29"))
        .andExpect(jsonPath("$.thisWeek[0].date").value("2026-07-01"))
        .andExpect(jsonPath("$.lastWeek.count").value(4))
        .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

    assertThat(client.summarize("user-1", report())).isTrue();
    server.verify();
  }

  @Test
  void notEnoughDataIsSkippedNotAnError() {
    server
        .expect(requestTo("http://genai-test/internal/summarize"))
        .andRespond(
            withStatus(HttpStatus.UNPROCESSABLE_ENTITY)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"detail\":\"NOT_ENOUGH_DATA\"}"));

    assertThat(client.summarize("user-1", report())).isFalse();
  }

  @Test
  void otherValidationErrorsStayErrors() {
    server
        .expect(requestTo("http://genai-test/internal/summarize"))
        .andRespond(
            withStatus(HttpStatus.UNPROCESSABLE_ENTITY)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"detail\":[{\"msg\":\"Input should be a valid date\"}]}"));

    assertThatThrownBy(() -> client.summarize("user-1", report()))
        .isInstanceOf(HttpClientErrorException.UnprocessableEntity.class);
  }

  @Test
  void contentTypeIsJson() {
    server
        .expect(requestTo("http://genai-test/internal/summarize"))
        .andExpect(content().contentType(MediaType.APPLICATION_JSON))
        .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

    client.summarize("user-1", report());
    server.verify();
  }
}
