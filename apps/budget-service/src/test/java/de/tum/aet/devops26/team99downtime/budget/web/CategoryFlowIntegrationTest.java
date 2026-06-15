package de.tum.aet.devops26.team99downtime.budget.web;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

/**
 * End-to-end CRUD flow against the real persistence layer (H2). Each test uses a distinct {@code
 * userId} so the shared application context stays isolated without per-test cleanup.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CategoryFlowIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  private static JwtRequestPostProcessor asUser(String userId) {
    return jwt().jwt(builder -> builder.subject(userId));
  }

  @Test
  void seedsPredefinedCategoriesOnFirstList() throws Exception {
    mockMvc
        .perform(get("/api/categories").with(asUser("seed-user")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(11))
        .andExpect(jsonPath("$[?(@.name == 'Groceries')]").exists());
  }

  @Test
  void createListUpdateDeleteFlow() throws Exception {
    String userId = "crud-user";

    // Create
    String created =
        mockMvc
            .perform(
                post("/api/categories")
                    .with(asUser(userId))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Coffee\",\"monthlyLimit\":50}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Coffee"))
            .andExpect(jsonPath("$.monthlyLimit").value(50))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String id = objectMapper.readTree(created).get("id").asText();

    // List contains the new category (alongside the seeded ones)
    mockMvc
        .perform(get("/api/categories").with(asUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[?(@.name == 'Coffee')]").exists());

    // Update
    mockMvc
        .perform(
            patch("/api/categories/" + id)
                .with(asUser(userId))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Coffee\",\"monthlyLimit\":75}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.monthlyLimit").value(75));

    // Delete
    mockMvc
        .perform(delete("/api/categories/" + id).with(asUser(userId)))
        .andExpect(status().isNoContent());

    // Gone
    mockMvc
        .perform(get("/api/categories").with(asUser(userId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[?(@.name == 'Coffee')]").doesNotExist());
  }

  @Test
  void rejectsDuplicateNameWithConflict() throws Exception {
    String userId = "dup-user";
    String body = "{\"name\":\"Subscriptions\",\"monthlyLimit\":30}";

    mockMvc
        .perform(
            post("/api/categories")
                .with(asUser(userId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());

    mockMvc
        .perform(
            post("/api/categories")
                .with(asUser(userId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isConflict());
  }

  @Test
  void cannotTouchAnotherUsersCategory() throws Exception {
    // owner creates a category
    String created =
        mockMvc
            .perform(
                post("/api/categories")
                    .with(asUser("owner"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Private\",\"monthlyLimit\":20}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    JsonNode node = objectMapper.readTree(created);
    String id = node.get("id").asText();

    // a different user cannot delete it
    mockMvc
        .perform(delete("/api/categories/" + id).with(asUser("intruder")))
        .andExpect(status().isNotFound());
  }
}
