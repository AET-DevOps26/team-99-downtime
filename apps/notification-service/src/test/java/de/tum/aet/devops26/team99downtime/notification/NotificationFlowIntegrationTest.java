package de.tum.aet.devops26.team99downtime.notification;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class NotificationFlowIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  private static JwtRequestPostProcessor asUser(String userId) {
    return jwt().jwt(b -> b.subject(userId));
  }

  @Test
  void createListMarkReadFlow() throws Exception {
    String userId = "notif-user-1";
    String body =
        """
        {"categoryId":"00000000-0000-0000-0000-000000000001",
         "categoryName":"Groceries","threshold":80,
         "percentUsed":83.33,"amountLeft":50.00}
        """;

    String created =
        mockMvc
            .perform(
                post("/api/notifications")
                    .with(asUser(userId))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.categoryName").value("Groceries"))
            .andExpect(jsonPath("$.readAt").isEmpty())
            .andReturn()
            .getResponse()
            .getContentAsString();

    String id = objectMapper.readTree(created).get("id").asText();

    mockMvc
        .perform(get("/api/notifications").with(asUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].categoryName").value("Groceries"));

    mockMvc
        .perform(patch("/api/notifications/" + id + "/read").with(asUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.readAt").isNotEmpty());
  }

  @Test
  void cannotReadAnotherUsersNotification() throws Exception {
    String created =
        mockMvc
            .perform(
                post("/api/notifications")
                    .with(asUser("notif-owner"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"categoryId":"00000000-0000-0000-0000-000000000002",
                         "categoryName":"Travel","threshold":100,
                         "percentUsed":100.00,"amountLeft":0.00}
                        """))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();

    String id = objectMapper.readTree(created).get("id").asText();

    mockMvc
        .perform(patch("/api/notifications/" + id + "/read").with(asUser("notif-intruder")))
        .andExpect(status().isNotFound());
  }

  @Test
  void unreadNotificationsAppearFirst() throws Exception {
    String userId = "notif-order-user";
    String template =
        """
        {"categoryId":"00000000-0000-0000-0000-000000000003",
         "categoryName":"Dining","threshold":80,
         "percentUsed":82.00,"amountLeft":18.00}
        """;

    // create two notifications
    String first =
        mockMvc
            .perform(
                post("/api/notifications")
                    .with(asUser(userId))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(template))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();

    mockMvc
        .perform(
            post("/api/notifications")
                .with(asUser(userId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(template))
        .andExpect(status().isCreated());

    // mark first as read
    String firstId = objectMapper.readTree(first).get("id").asText();
    mockMvc.perform(patch("/api/notifications/" + firstId + "/read").with(asUser(userId)));

    // unread (second) should come first in the list
    mockMvc
        .perform(get("/api/notifications").with(asUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].readAt").isEmpty())
        .andExpect(jsonPath("$[1].readAt").isNotEmpty());
  }
}
