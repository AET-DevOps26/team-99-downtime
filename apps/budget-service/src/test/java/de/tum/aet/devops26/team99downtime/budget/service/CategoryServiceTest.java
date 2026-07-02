package de.tum.aet.devops26.team99downtime.budget.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import de.tum.aet.devops26.team99downtime.budget.domain.Category;
import de.tum.aet.devops26.team99downtime.budget.dto.CategoryRequest;
import de.tum.aet.devops26.team99downtime.budget.repository.CategoryRepository;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CategoryServiceTest {

  @Mock CategoryRepository repository;
  @InjectMocks CategoryService service;

  @Test
  void createStoresNameInTitleCase() {
    when(repository.save(any(Category.class))).thenAnswer(inv -> inv.getArgument(0));

    service.create("user-1", new CategoryRequest("  dINING   oUT ", new BigDecimal("150")));

    ArgumentCaptor<Category> saved = ArgumentCaptor.forClass(Category.class);
    org.mockito.Mockito.verify(repository).save(saved.capture());
    assertThat(saved.getValue().getName()).isEqualTo("Dining Out");
  }

  @Test
  void titleCaseNormalizesAssortedInput() {
    assertThat(CategoryService.titleCase("groceries")).isEqualTo("Groceries");
    assertThat(CategoryService.titleCase("GROCERIES")).isEqualTo("Groceries");
    assertThat(CategoryService.titleCase("debt & loans")).isEqualTo("Debt & Loans");
    assertThat(CategoryService.titleCase("  travel ")).isEqualTo("Travel");
  }
}
