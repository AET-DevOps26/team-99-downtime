package de.tum.aet.devops26.team99downtime.transaction.service;

import de.tum.aet.devops26.team99downtime.transaction.domain.NoCategoriesException;
import de.tum.aet.devops26.team99downtime.transaction.domain.Transaction;
import de.tum.aet.devops26.team99downtime.transaction.domain.TransactionNotFoundException;
import de.tum.aet.devops26.team99downtime.transaction.domain.UpstreamServiceException;
import de.tum.aet.devops26.team99downtime.transaction.dto.SkippedRow;
import de.tum.aet.devops26.team99downtime.transaction.dto.SpendEntry;
import de.tum.aet.devops26.team99downtime.transaction.dto.TransactionRequest;
import de.tum.aet.devops26.team99downtime.transaction.repository.TransactionRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
public class TransactionService {

  private final TransactionRepository repository;
  private final ThresholdCheckClient thresholdCheckClient;
  private final CategoryClient categoryClient;
  private final GenAiClient genAiClient;

  public TransactionService(
      TransactionRepository repository,
      ThresholdCheckClient thresholdCheckClient,
      CategoryClient categoryClient,
      GenAiClient genAiClient) {
    this.repository = repository;
    this.thresholdCheckClient = thresholdCheckClient;
    this.categoryClient = categoryClient;
    this.genAiClient = genAiClient;
  }

  public Page<Transaction> list(String userId, Pageable pageable) {
    return repository.findByUserIdOrderByDateDescCreatedAtDesc(userId, pageable);
  }

  public Transaction create(String userId, TransactionRequest request, String authHeader) {
    Transaction transaction =
        new Transaction(
            userId,
            request.categoryId(),
            request.amount(),
            request.currency(),
            request.description(),
            request.date());
    Transaction saved = repository.save(transaction);
    thresholdCheckClient.trigger(authHeader);
    return saved;
  }

  /**
   * Turns a free-text sentence into one or more persisted transactions. The genai-service extracts
   * amount/merchant/category/date, choosing among the user's existing category names. One threshold
   * check fires at the end, so the budget-service sees the complete new spend.
   */
  public List<Transaction> createFromFreeText(String userId, String text, String authHeader) {
    List<CategoryClient.CategoryDto> categories = categoryClient.list(authHeader);
    if (categories.isEmpty()) {
      throw new NoCategoriesException();
    }
    List<String> names = categories.stream().map(CategoryClient.CategoryDto::name).toList();
    List<GenAiClient.CategorizedExpense> expenses = genAiClient.categorize(text, names, authHeader);
    List<Transaction> saved =
        expenses.stream()
            .map(
                expense ->
                    repository.save(
                        new Transaction(
                            userId,
                            resolveCategoryId(categories, expense.category()),
                            expense.amount(),
                            expense.currency() == null || expense.currency().isBlank()
                                ? "EUR"
                                : expense.currency(),
                            expense.merchant(),
                            expense.date())))
            .toList();
    thresholdCheckClient.trigger(authHeader);
    return saved;
  }

  private static UUID resolveCategoryId(List<CategoryClient.CategoryDto> categories, String name) {
    return findCategoryId(categories, name)
        .orElseThrow(
            () ->
                new UpstreamServiceException(
                    "genai-service returned unknown category '" + name + "'"));
  }

  private static Optional<UUID> findCategoryId(
      List<CategoryClient.CategoryDto> categories, String name) {
    return categories.stream()
        .filter(category -> category.name().equalsIgnoreCase(name))
        .findFirst()
        .map(CategoryClient.CategoryDto::id);
  }

  /**
   * Imports a raw bank CSV: the genai-service parses and categorizes each debit row, every usable
   * row becomes a transaction, unusable rows are collected as skipped (the import never fails
   * row-by-row). One threshold check fires at the end if anything was imported.
   */
  public CsvImportOutcome importCsv(String userId, String csv, String authHeader) {
    List<CategoryClient.CategoryDto> categories = categoryClient.list(authHeader);
    if (categories.isEmpty()) {
      throw new NoCategoriesException();
    }
    List<String> names = categories.stream().map(CategoryClient.CategoryDto::name).toList();
    GenAiClient.CsvParseResult parsed = genAiClient.parseCsv(csv, names, authHeader);

    List<Transaction> imported = new ArrayList<>();
    List<SkippedRow> skipped = new ArrayList<>(parsed.skipped());
    for (GenAiClient.CsvExpense expense : parsed.expenses()) {
      Optional<UUID> categoryId = findCategoryId(categories, expense.category());
      if (categoryId.isEmpty()) {
        skipped.add(new SkippedRow(expense.row(), "unknown category '" + expense.category() + "'"));
        continue;
      }
      imported.add(
          repository.save(
              new Transaction(
                  userId,
                  categoryId.get(),
                  expense.amount(),
                  expense.currency() == null || expense.currency().isBlank()
                      ? "EUR"
                      : expense.currency(),
                  expense.merchant(),
                  expense.date())));
    }
    if (!imported.isEmpty()) {
      thresholdCheckClient.trigger(authHeader);
    }
    skipped.sort((a, b) -> Integer.compare(a.row(), b.row()));
    return new CsvImportOutcome(imported, skipped);
  }

  public record CsvImportOutcome(List<Transaction> imported, List<SkippedRow> skipped) {}

  public Transaction update(String userId, UUID id, TransactionRequest request, String authHeader) {
    Transaction transaction = requireOwned(userId, id);
    transaction.setCategoryId(request.categoryId());
    transaction.setAmount(request.amount());
    transaction.setCurrency(request.currency());
    transaction.setDescription(request.description());
    transaction.setDate(request.date());
    Transaction saved = repository.save(transaction);
    thresholdCheckClient.trigger(authHeader);
    return saved;
  }

  public void delete(String userId, UUID id, String authHeader) {
    repository.delete(requireOwned(userId, id));
    thresholdCheckClient.trigger(authHeader);
  }

  public List<SpendEntry> getSpend(String userId) {
    LocalDate start = LocalDate.now().withDayOfMonth(1);
    LocalDate end = start.plusMonths(1);
    return repository.findSpendByCategory(userId, start, end);
  }

  private Transaction requireOwned(String userId, UUID id) {
    return repository.findByIdAndUserId(id, userId).orElseThrow(TransactionNotFoundException::new);
  }
}
