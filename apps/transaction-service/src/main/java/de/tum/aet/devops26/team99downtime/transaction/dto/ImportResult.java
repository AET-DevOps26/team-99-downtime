package de.tum.aet.devops26.team99downtime.transaction.dto;

import java.util.List;

/** Per-row outcome of a CSV import: what was persisted and what was skipped why. */
public record ImportResult(List<TransactionResponse> imported, List<SkippedRow> skipped) {}
