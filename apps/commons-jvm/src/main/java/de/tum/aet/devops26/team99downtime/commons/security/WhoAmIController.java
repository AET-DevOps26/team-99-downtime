package de.tum.aet.devops26.team99downtime.commons.security;

import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Probe endpoint proving JWT validation works end-to-end. Reaching this means the request carried a
 * valid token from the auth-service; the {@code sub} claim is the user id the other services treat
 * as {@code userId}.
 */
@RestController
public class WhoAmIController {

  @GetMapping("${service.me-path:/api/me}")
  public Map<String, Object> me(@AuthenticationPrincipal Jwt jwt) {
    return Map.of(
        "userId", jwt.getSubject(),
        "email", jwt.getClaimAsString("email"),
        "issuer", jwt.getIssuer().toString());
  }
}
