package de.tum.aet.devops26.team99downtime.transaction.dto;

/** A CSV row that was not imported: its 1-based line number and the reason. */
public record SkippedRow(int row, String reason) {}
