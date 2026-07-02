package de.tum.aet.devops26.team99downtime.transaction.dto;

import jakarta.validation.constraints.NotBlank;

/** A free-text sentence to turn into one or more transactions. */
public record FreeTextRequest(@NotBlank String text) {}
