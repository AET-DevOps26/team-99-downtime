package de.tum.aet.devops26.team99downtime.budget.web;

import de.tum.aet.devops26.team99downtime.budget.dto.BudgetStatusResponse;
import de.tum.aet.devops26.team99downtime.budget.service.BudgetStatusService;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class BudgetStatusController {

  private final BudgetStatusService service;

  public BudgetStatusController(BudgetStatusService service) {
    this.service = service;
  }

  @GetMapping("/api/budgets/status")
  public List<BudgetStatusResponse> status(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader(HttpHeaders.AUTHORIZATION) String authHeader) {
    return service.getStatus(jwt.getSubject(), authHeader);
  }
}
