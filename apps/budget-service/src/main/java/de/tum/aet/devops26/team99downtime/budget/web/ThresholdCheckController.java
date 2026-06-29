package de.tum.aet.devops26.team99downtime.budget.web;

import de.tum.aet.devops26.team99downtime.budget.service.ThresholdCheckService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ThresholdCheckController {

  private final ThresholdCheckService service;

  public ThresholdCheckController(ThresholdCheckService service) {
    this.service = service;
  }

  @PostMapping("/api/budgets/threshold-check")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void check(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader(HttpHeaders.AUTHORIZATION) String authHeader) {
    service.check(jwt.getSubject(), authHeader);
  }
}
