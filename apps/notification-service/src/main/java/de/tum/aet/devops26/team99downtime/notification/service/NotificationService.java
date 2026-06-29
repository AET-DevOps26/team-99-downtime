package de.tum.aet.devops26.team99downtime.notification.service;

import de.tum.aet.devops26.team99downtime.notification.domain.Notification;
import de.tum.aet.devops26.team99downtime.notification.domain.NotificationNotFoundException;
import de.tum.aet.devops26.team99downtime.notification.dto.NotificationCreateRequest;
import de.tum.aet.devops26.team99downtime.notification.dto.NotificationResponse;
import de.tum.aet.devops26.team99downtime.notification.repository.NotificationRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {

  private final NotificationRepository repository;
  private final NotificationStreamService streamService;

  public NotificationService(
      NotificationRepository repository, NotificationStreamService streamService) {
    this.repository = repository;
    this.streamService = streamService;
  }

  public Notification create(String userId, NotificationCreateRequest request) {
    Notification notification =
        new Notification(
            userId,
            request.categoryId(),
            request.categoryName(),
            request.threshold(),
            request.percentUsed(),
            request.amountLeft());
    Notification saved = repository.save(notification);
    streamService.push(userId, NotificationResponse.from(saved));
    return saved;
  }

  public List<Notification> listForUser(String userId) {
    return repository.findByUserIdOrderedByUnreadFirst(userId);
  }

  public Notification markAsRead(String userId, UUID id) {
    Notification notification =
        repository.findByIdAndUserId(id, userId).orElseThrow(NotificationNotFoundException::new);
    notification.setReadAt(LocalDateTime.now());
    return repository.save(notification);
  }
}
