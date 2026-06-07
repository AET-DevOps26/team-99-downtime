package de.tum.aet.devops26.team99downtime.budget.repository;

import de.tum.aet.devops26.team99downtime.budget.domain.Category;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Persistence for {@link Category}. Every lookup is scoped by {@code userId} so a user can only
 * ever read or mutate their own categories.
 */
public interface CategoryRepository extends JpaRepository<Category, UUID> {

  List<Category> findByUserId(String userId);

  Optional<Category> findByIdAndUserId(UUID id, String userId);

  boolean existsByUserId(String userId);
}
