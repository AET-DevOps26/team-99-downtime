package de.tum.aet.devops26.team99downtime.transaction.service;

import de.tum.aet.devops26.team99downtime.transaction.repository.TransactionRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The weekly AI summary scheduler (US-11): once a week, generates a summary for every user with
 * recent transactions by posting their {@link de.tum.aet.devops26.team99downtime.transaction.dto
 * .WeeklyReport} to the genai-service. It lives here rather than in genai because this service owns
 * the transaction data — a cron has no user JWT, so it cannot fetch through the user-scoped APIs.
 *
 * <p>Default schedule is Sunday evening (see {@code summary.cron} in application.yaml), when the
 * week being summarized is effectively complete. One user failing never blocks the rest.
 */
@Component
public class WeeklySummaryJob {

  private static final Logger LOG = LoggerFactory.getLogger(WeeklySummaryJob.class);

  private final TransactionRepository repository;
  private final TransactionService transactionService;
  private final SummaryClient summaryClient;

  public WeeklySummaryJob(
      TransactionRepository repository,
      TransactionService transactionService,
      SummaryClient summaryClient) {
    this.repository = repository;
    this.transactionService = transactionService;
    this.summaryClient = summaryClient;
  }

  @Scheduled(cron = "${summary.cron}", zone = "${summary.zone}")
  public void run() {
    LocalDate weekStart = LocalDate.now().with(DayOfWeek.MONDAY);
    List<String> userIds = repository.findActiveUserIds(weekStart.minusWeeks(1));
    int generated = 0;
    int skipped = 0;
    int failed = 0;
    for (String userId : userIds) {
      try {
        if (summaryClient.summarize(userId, transactionService.weeklyReport(userId))) {
          generated++;
        } else {
          skipped++;
        }
      } catch (Exception e) {
        failed++;
        LOG.warn("Weekly summary failed for user {}: {}", userId, e.getMessage());
      }
    }
    LOG.info(
        "Weekly AI summaries: {} generated, {} skipped (not enough data), {} failed"
            + " of {} active users",
        generated,
        skipped,
        failed,
        userIds.size());
  }
}
