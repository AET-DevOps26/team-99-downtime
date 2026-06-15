package de.tum.aet.devops26.team99downtime.budget.service;

import de.tum.aet.devops26.team99downtime.budget.domain.Category;
import de.tum.aet.devops26.team99downtime.budget.domain.CategoryNotFoundException;
import de.tum.aet.devops26.team99downtime.budget.dto.CategoryRequest;
import de.tum.aet.devops26.team99downtime.budget.repository.CategoryRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Business logic for categories. Every operation is scoped to a single {@code userId} (the JWT
 * subject) so users only ever see and mutate their own categories.
 */
@Service
public class CategoryService {

  /**
   * Categories every user starts with, seeded the first time they read their list. Limits are
   * sensible starting points the user is expected to adjust.
   */
  private static final List<Category> PREDEFINED =
      List.of(
          predefined("Insurance", "150"),
          predefined("Groceries", "300"),
          predefined("Transportation", "100"),
          predefined("Healthcare", "80"),
          predefined("Dining Out", "150"),
          predefined("Entertainment", "100"),
          predefined("Debt & Loans", "200"),
          predefined("Utilities", "200"),
          predefined("Travel", "100"),
          predefined("Uncategorized", "50"),
          predefined("Shopping", "150"));

  private final CategoryRepository repository;

  public CategoryService(CategoryRepository repository) {
    this.repository = repository;
  }

  /** Lists a user's categories, seeding the predefined set on first access. */
  public List<Category> listForUser(String userId) {
    if (!repository.existsByUserId(userId)) {
      seedPredefined(userId);
    }
    return repository.findByUserId(userId);
  }

  public Category create(String userId, CategoryRequest request) {
    return repository.save(new Category(userId, request.name(), request.monthlyLimit()));
  }

  public Category update(String userId, UUID id, CategoryRequest request) {
    Category category = requireOwned(userId, id);
    category.setName(request.name());
    category.setMonthlyLimit(request.monthlyLimit());
    return repository.save(category);
  }

  public void delete(String userId, UUID id) {
    repository.delete(requireOwned(userId, id));
  }

  private Category requireOwned(String userId, UUID id) {
    return repository.findByIdAndUserId(id, userId).orElseThrow(CategoryNotFoundException::new);
  }

  private void seedPredefined(String userId) {
    List<Category> seeded =
        PREDEFINED.stream()
            .map(template -> new Category(userId, template.getName(), template.getMonthlyLimit()))
            .toList();
    repository.saveAll(seeded);
  }

  private static Category predefined(String name, String monthlyLimit) {
    return new Category(null, name, new BigDecimal(monthlyLimit));
  }
}
