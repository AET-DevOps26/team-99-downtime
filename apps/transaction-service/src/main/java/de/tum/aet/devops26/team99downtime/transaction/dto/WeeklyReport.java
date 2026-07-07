package de.tum.aet.devops26.team99downtime.transaction.dto;

import de.tum.aet.devops26.team99downtime.transaction.domain.Transaction;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * One user's week of expenses plus the previous week's totals — the payload the genai-service turns
 * into the weekly AI summary (US-11). Shared by the dashboard's manual trigger (via {@code GET
 * /api/transactions/weekly-report}) and the weekly scheduler, so both paths summarize identical
 * data.
 */
public record WeeklyReport(LocalDate weekStart, List<Entry> thisWeek, LastWeek lastWeek) {

  /** One expense of the reported week. Category names live in budget-service, so no category. */
  public record Entry(LocalDate date, BigDecimal amount, String currency, String description) {

    public static Entry from(Transaction transaction) {
      return new Entry(
          transaction.getDate(),
          transaction.getAmount(),
          transaction.getCurrency(),
          transaction.getDescription());
    }
  }

  /** Aggregate of the week before, for the week-over-week comparison. */
  public record LastWeek(BigDecimal total, int count) {}
}
