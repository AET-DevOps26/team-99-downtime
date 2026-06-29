package de.tum.aet.devops26.team99downtime.notification.domain;

public class NotificationNotFoundException extends RuntimeException {
  public NotificationNotFoundException() {
    super("Notification not found");
  }
}
