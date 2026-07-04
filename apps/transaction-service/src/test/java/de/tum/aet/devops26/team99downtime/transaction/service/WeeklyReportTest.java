package de.tum.aet.devops26.team99downtime.transaction.service;

import static org.assertj.core.api.Assertions.assertThat;

import de.tum.aet.devops26.team99downtime.transaction.domain.Transaction;
import de.tum.aet.devops26.team99downtime.transaction.dto.WeeklyReport;
import de.tum.aet.devops26.team99downtime.transaction.repository.TransactionRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** Week-window logic of the AI summary report: fixed dates, so results never depend on today. */
@SpringBootTest
class WeeklyReportTest {

  @Autowired private TransactionService service;
  @Autowired private TransactionRepository repository;

  // 2026-07-01 is a Wednesday; its ISO week runs Mon 2026-06-29 .. Sun 2026-07-05.
  private static final LocalDate WEDNESDAY = LocalDate.of(2026, 7, 1);
  private static final LocalDate MONDAY = LocalDate.of(2026, 6, 29);

  @BeforeEach
  void clear() {
    repository.deleteAll();
  }

  private void tx(LocalDate date, String amount, String description) {
    repository.save(
        new Transaction(
            "report-user", UUID.randomUUID(), new BigDecimal(amount), "EUR", description, date));
  }

  @Test
  void bucketsTransactionsIntoThisWeekAndLastWeekTotals() {
    tx(MONDAY, "10.00", "Monday this week");
    tx(MONDAY.plusDays(6), "5.00", "Sunday this week");
    tx(MONDAY.minusDays(1), "20.00", "Sunday last week");
    tx(MONDAY.minusDays(7), "2.50", "Monday last week");
    tx(MONDAY.minusDays(8), "99.00", "Before last week");

    WeeklyReport report = service.weeklyReport("report-user", WEDNESDAY);

    assertThat(report.weekStart()).isEqualTo(MONDAY);
    assertThat(report.thisWeek())
        .extracting(WeeklyReport.Entry::description)
        .containsExactly("Monday this week", "Sunday this week");
    assertThat(report.lastWeek().total()).isEqualByComparingTo("22.50");
    assertThat(report.lastWeek().count()).isEqualTo(2);
  }

  @Test
  void emptyWeeksProduceAnEmptyReport() {
    WeeklyReport report = service.weeklyReport("report-user", WEDNESDAY);

    assertThat(report.thisWeek()).isEmpty();
    assertThat(report.lastWeek().total()).isEqualByComparingTo("0");
    assertThat(report.lastWeek().count()).isZero();
  }
}
