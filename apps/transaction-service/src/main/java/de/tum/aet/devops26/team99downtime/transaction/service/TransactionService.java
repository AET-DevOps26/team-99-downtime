package de.tum.aet.devops26.team99downtime.transaction.service;

import de.tum.aet.devops26.team99downtime.transaction.domain.Transaction;
import de.tum.aet.devops26.team99downtime.transaction.domain.TransactionNotFoundException;
import de.tum.aet.devops26.team99downtime.transaction.dto.SpendEntry;
import de.tum.aet.devops26.team99downtime.transaction.dto.TransactionRequest;
import de.tum.aet.devops26.team99downtime.transaction.repository.TransactionRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
public class TransactionService {

  private final TransactionRepository repository;
  private final ThresholdCheckClient thresholdCheckClient;

  public TransactionService(
      TransactionRepository repository, ThresholdCheckClient thresholdCheckClient) {
    this.repository = repository;
    this.thresholdCheckClient = thresholdCheckClient;
  }

  public Page<Transaction> list(String userId, Pageable pageable) {
    return repository.findByUserIdOrderByDateDesc(userId, pageable);
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
