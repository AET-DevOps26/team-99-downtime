package de.tum.aet.devops26.team99downtime.commons;

import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;

/**
 * Minimal Spring Boot context anchor for slice tests in this library. The module ships no
 * {@code @SpringBootApplication} of its own (it is a library, not a deployable), so
 * {@code @WebMvcTest} and friends need an explicit {@code @SpringBootConfiguration} to find when
 * searching upward from the test package.
 */
@SpringBootConfiguration
@EnableAutoConfiguration
public class TestApplication {}
