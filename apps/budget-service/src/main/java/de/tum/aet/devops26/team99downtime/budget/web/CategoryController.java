package de.tum.aet.devops26.team99downtime.budget.web;

import de.tum.aet.devops26.team99downtime.budget.dto.CategoryRequest;
import de.tum.aet.devops26.team99downtime.budget.dto.CategoryResponse;
import de.tum.aet.devops26.team99downtime.budget.service.CategoryService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * CRUD over a user's spending categories. The owning user is taken from the validated JWT ({@code
 * jwt.getSubject()} is the {@code userId}) — never from the request body — so callers can only ever
 * touch their own data.
 */
@RestController
@RequestMapping("/api/budgets/categories")
public class CategoryController {

  private final CategoryService service;

  public CategoryController(CategoryService service) {
    this.service = service;
  }

  @GetMapping
  public List<CategoryResponse> list(@AuthenticationPrincipal Jwt jwt) {
    return service.listForUser(jwt.getSubject()).stream().map(CategoryResponse::from).toList();
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public CategoryResponse create(
      @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CategoryRequest request) {
    return CategoryResponse.from(service.create(jwt.getSubject(), request));
  }

  @PatchMapping("/{id}")
  public CategoryResponse update(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @Valid @RequestBody CategoryRequest request) {
    return CategoryResponse.from(service.update(jwt.getSubject(), id, request));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    service.delete(jwt.getSubject(), id);
  }
}
