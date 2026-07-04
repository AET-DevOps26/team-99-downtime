package de.tum.aet.devops26.team99downtime.transaction.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.tum.aet.devops26.team99downtime.transaction.domain.Transaction;
import de.tum.aet.devops26.team99downtime.transaction.dto.WeeklyReport;
import de.tum.aet.devops26.team99downtime.transaction.repository.TransactionRepository;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Scheduler integration test (issue #24): seeds real transactions, runs the job against the real
 * repository + report building, and verifies what would be posted to the genai-service.
 */
@SpringBootTest
class WeeklySummaryJobTest {

  @Autowired private WeeklySummaryJob job;
  @Autowired private TransactionRepository repository;
  @MockitoBean private SummaryClient summaryClient;

  private static final UUID CATEGORY = UUID.randomUUID();
  private final LocalDate weekStart = LocalDate.now().with(DayOfWeek.MONDAY);

  @BeforeEach
  void seed() {
    repository.deleteAll();
    when(summaryClient.summarize(any(), any())).thenReturn(true);
  }

  private void tx(String userId, LocalDate date, String amount, String description) {
    repository.save(
        new Transaction(userId, CATEGORY, new BigDecimal(amount), "EUR", description, date));
  }

  @Test
  void summarizesEachActiveUserWithTheirWeeklyReport() {
    tx("active-user", weekStart, "12.50", "Rewe");
    tx("active-user", weekStart.plusDays(1), "8.00", "Mensa");
    tx("active-user", weekStart.plusDays(5), "30.00", "DB Ticket");
    tx("active-user", weekStart.minusDays(2), "40.00", "Last week groceries");
    tx("active-user", weekStart.minusDays(3), "1.20", "Last week coffee");

    job.run();

    ArgumentCaptor<WeeklyReport> report = ArgumentCaptor.forClass(WeeklyReport.class);
    verify(summaryClient).summarize(eq("active-user"), report.capture());
    assertThat(report.getValue().weekStart()).isEqualTo(weekStart);
    assertThat(report.getValue().thisWeek())
        .extracting(WeeklyReport.Entry::description)
        .containsExactly("Rewe", "Mensa", "DB Ticket");
    assertThat(report.getValue().lastWeek().total()).isEqualByComparingTo("41.20");
    assertThat(report.getValue().lastWeek().count()).isEqualTo(2);
  }

  @Test
  void ignoresUsersWithoutRecentTransactions() {
    tx("dormant-user", weekStart.minusWeeks(3), "99.00", "Old expense");

    job.run();

    verify(summaryClient, never()).summarize(eq("dormant-user"), any());
  }

  @Test
  void oneFailingUserDoesNotBlockTheOthers() {
    tx("failing-user", weekStart, "1.00", "A");
    tx("healthy-user", weekStart, "2.00", "B");
    when(summaryClient.summarize(eq("failing-user"), any()))
        .thenThrow(new RuntimeException("genai down"));

    job.run();

    verify(summaryClient).summarize(eq("healthy-user"), any());
  }
}
