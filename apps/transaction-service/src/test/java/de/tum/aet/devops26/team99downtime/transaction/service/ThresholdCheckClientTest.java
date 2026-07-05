package de.tum.aet.devops26.team99downtime.transaction.service;

import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class ThresholdCheckClientTest {

  private static final String BUDGET_URL = "https://budget-service";
  private static final String AUTH = "Bearer token";

  @Test
  void triggerPostsAuthorizationHeaderToBudgetService() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    ThresholdCheckClient client = new ThresholdCheckClient(BUDGET_URL, builder);
    server
        .expect(once(), requestTo(BUDGET_URL + "/api/budgets/threshold-check"))
        .andExpect(method(HttpMethod.POST))
        .andExpect(header(HttpHeaders.AUTHORIZATION, AUTH))
        .andRespond(withSuccess());

    client.trigger(AUTH);

    server.verify();
  }

  @Test
  void triggerSkipsCallWhenAuthorizationHeaderIsMissing() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    ThresholdCheckClient client = new ThresholdCheckClient(BUDGET_URL, builder);

    client.trigger(null);

    server.verify();
  }

  @Test
  void triggerSwallowsBudgetServiceFailures() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    ThresholdCheckClient client = new ThresholdCheckClient(BUDGET_URL, builder);
    server
        .expect(once(), requestTo(BUDGET_URL + "/api/budgets/threshold-check"))
        .andExpect(method(HttpMethod.POST))
        .andRespond(withServerError());

    client.trigger(AUTH);

    server.verify();
  }
}
