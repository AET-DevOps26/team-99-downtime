package de.tum.aet.devops26.team99downtime.budget.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.tum.aet.devops26.team99downtime.budget.domain.Category;
import de.tum.aet.devops26.team99downtime.budget.service.CategoryService;
import de.tum.aet.devops26.team99downtime.commons.security.SecurityConfig;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Validation and error-mapping contract for the category API, with the service mocked so only the
 * web layer (bean validation + {@link GlobalExceptionHandler}) is exercised.
 */
@WebMvcTest(CategoryController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
@TestPropertySource(
    properties = {
      "spring.security.oauth2.resourceserver.jwt.jwk-set-uri=http://auth-service:3000/api/auth/jwks",
      "auth.issuer=http://localhost:9099"
    })
class CategoryControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private CategoryService service;

  @Test
  void rejectsRequestWithoutToken() throws Exception {
    mockMvc
        .perform(
            post("/api/budgets/categories")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Coffee\",\"monthlyLimit\":50}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void rejectsBlankName() throws Exception {
    mockMvc
        .perform(authedPost("{\"name\":\"  \",\"monthlyLimit\":50}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fields.name").exists());
  }

  @Test
  void rejectsZeroLimit() throws Exception {
    mockMvc
        .perform(authedPost("{\"name\":\"Coffee\",\"monthlyLimit\":0}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fields.monthlyLimit").exists());
  }

  @Test
  void rejectsNegativeLimit() throws Exception {
    mockMvc
        .perform(authedPost("{\"name\":\"Coffee\",\"monthlyLimit\":-10}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fields.monthlyLimit").exists());
  }

  @Test
  void mapsDuplicateNameToConflict() throws Exception {
    when(service.create(anyString(), any()))
        .thenThrow(new DataIntegrityViolationException("unique violation"));

    mockMvc
        .perform(authedPost("{\"name\":\"Groceries\",\"monthlyLimit\":300}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.error").value("duplicate_category"));
  }

  @Test
  void createsValidCategory() throws Exception {
    when(service.create(anyString(), any()))
        .thenReturn(new Category("user-1", "Coffee", new BigDecimal("50")));

    mockMvc
        .perform(authedPost("{\"name\":\"Coffee\",\"monthlyLimit\":50}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.name").value("Coffee"));
  }

  private static MockHttpServletRequestBuilder authedPost(String body) {
    return post("/api/budgets/categories")
        .with(jwt().jwt(builder -> builder.subject("user-1")))
        .contentType(MediaType.APPLICATION_JSON)
        .content(body);
  }
}
