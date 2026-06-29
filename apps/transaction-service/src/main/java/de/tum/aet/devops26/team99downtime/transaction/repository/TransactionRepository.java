package de.tum.aet.devops26.team99downtime.transaction.repository;

import de.tum.aet.devops26.team99downtime.transaction.domain.Transaction;
import de.tum.aet.devops26.team99downtime.transaction.dto.SpendEntry;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

  Page<Transaction> findByUserIdOrderByDateDescCreatedAtDesc(String userId, Pageable pageable);

  Optional<Transaction> findByIdAndUserId(UUID id, String userId);

  @Query(
      "SELECT new de.tum.aet.devops26.team99downtime.transaction.dto.SpendEntry("
          + "t.categoryId, SUM(t.amount)) "
          + "FROM Transaction t "
          + "WHERE t.userId = :userId AND t.date >= :start AND t.date < :end "
          + "GROUP BY t.categoryId")
  List<SpendEntry> findSpendByCategory(
      @Param("userId") String userId, @Param("start") LocalDate start, @Param("end") LocalDate end);
}
