package de.tum.aet.devops26.team99downtime.transaction.web;

import de.tum.aet.devops26.team99downtime.transaction.domain.InvalidFileException;
import de.tum.aet.devops26.team99downtime.transaction.dto.FreeTextRequest;
import de.tum.aet.devops26.team99downtime.transaction.dto.ImportResult;
import de.tum.aet.devops26.team99downtime.transaction.dto.SpendEntry;
import de.tum.aet.devops26.team99downtime.transaction.dto.TransactionRequest;
import de.tum.aet.devops26.team99downtime.transaction.dto.TransactionResponse;
import de.tum.aet.devops26.team99downtime.transaction.service.TransactionService;
import jakarta.validation.Valid;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

  private final TransactionService service;

  public TransactionController(TransactionService service) {
    this.service = service;
  }

  @GetMapping
  public Page<TransactionResponse> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service
        .list(jwt.getSubject(), PageRequest.of(page, size, Sort.by("date").descending()))
        .map(TransactionResponse::from);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public TransactionResponse create(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authHeader,
      @Valid @RequestBody TransactionRequest request) {
    return TransactionResponse.from(service.create(jwt.getSubject(), request, authHeader));
  }

  @PostMapping("/free-text")
  @ResponseStatus(HttpStatus.CREATED)
  public List<TransactionResponse> createFromFreeText(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authHeader,
      @Valid @RequestBody FreeTextRequest request) {
    return service.createFromFreeText(jwt.getSubject(), request.text(), authHeader).stream()
        .map(TransactionResponse::from)
        .toList();
  }

  @PostMapping(path = "/import", consumes = "multipart/form-data")
  public ImportResult importFile(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authHeader,
      @RequestParam("file") MultipartFile file) {
    TransactionService.FileImportOutcome outcome =
        service.importFile(jwt.getSubject(), readTextFile(file), authHeader);
    return new ImportResult(
        outcome.imported().stream().map(TransactionResponse::from).toList(), outcome.skipped());
  }

  private static String readTextFile(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new InvalidFileException("The uploaded file is empty");
    }
    if (file.getSize() > 200 * 1024) {
      throw new InvalidFileException("The file is too large (max 200 KB)");
    }
    String content;
    try {
      content = new String(file.getBytes(), StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new InvalidFileException("The file could not be read");
    }
    if (content.indexOf('\0') >= 0) {
      throw new InvalidFileException("The file is not a text file");
    }
    return content;
  }

  @PatchMapping("/{id}")
  public TransactionResponse update(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authHeader,
      @PathVariable UUID id,
      @Valid @RequestBody TransactionRequest request) {
    return TransactionResponse.from(service.update(jwt.getSubject(), id, request, authHeader));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(
      @AuthenticationPrincipal Jwt jwt,
      @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authHeader,
      @PathVariable UUID id) {
    service.delete(jwt.getSubject(), id, authHeader);
  }

  @GetMapping("/spend")
  public List<SpendEntry> spend(@AuthenticationPrincipal Jwt jwt) {
    return service.getSpend(jwt.getSubject());
  }
}
