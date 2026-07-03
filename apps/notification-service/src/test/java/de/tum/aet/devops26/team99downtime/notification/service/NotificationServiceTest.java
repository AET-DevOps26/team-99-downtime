package de.tum.aet.devops26.team99downtime.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import de.tum.aet.devops26.team99downtime.notification.domain.Notification;
import de.tum.aet.devops26.team99downtime.notification.domain.NotificationNotFoundException;
import de.tum.aet.devops26.team99downtime.notification.dto.NotificationCreateRequest;
import de.tum.aet.devops26.team99downtime.notification.dto.NotificationResponse;
import de.tum.aet.devops26.team99downtime.notification.repository.NotificationRepository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

  @Mock NotificationRepository repository;
  @Mock NotificationStreamService streamService;
  @InjectMocks NotificationService service;

  @Test
  void createPersistsNotificationAndPushesSavedNotificationToStream() {
    String userId = "user-1";
    UUID notificationId = UUID.randomUUID();
    UUID categoryId = UUID.randomUUID();
    NotificationCreateRequest request =
        new NotificationCreateRequest(
            categoryId, "Groceries", 80, new BigDecimal("83.33"), new BigDecimal("50.00"));

    when(repository.save(any(Notification.class)))
        .thenAnswer(
            invocation -> {
              Notification notification = invocation.getArgument(0);
              notification.setId(notificationId);
              return notification;
            });

    Notification result = service.create(userId, request);

    ArgumentCaptor<Notification> saved = ArgumentCaptor.forClass(Notification.class);
    verify(repository).save(saved.capture());

    Notification persisted = saved.getValue();
    assertThat(persisted.getUserId()).isEqualTo(userId);
    assertThat(persisted.getCategoryId()).isEqualTo(categoryId);
    assertThat(persisted.getCategoryName()).isEqualTo("Groceries");
    assertThat(persisted.getThreshold()).isEqualTo(80);
    assertThat(persisted.getPercentUsed()).isEqualByComparingTo("83.33");
    assertThat(persisted.getAmountLeft()).isEqualByComparingTo("50.00");
    assertThat(persisted.getCreatedAt()).isNotNull();
    assertThat(persisted.getReadAt()).isNull();
    assertThat(result).isSameAs(persisted);

    ArgumentCaptor<NotificationResponse> pushed =
        ArgumentCaptor.forClass(NotificationResponse.class);
    verify(streamService).push(eq(userId), pushed.capture());
    assertThat(pushed.getValue().id()).isEqualTo(notificationId);
    assertThat(pushed.getValue().categoryId()).isEqualTo(categoryId);
    assertThat(pushed.getValue().categoryName()).isEqualTo("Groceries");
    assertThat(pushed.getValue().readAt()).isNull();
  }

  @Test
  void listForUserReturnsRepositoryOrdering() {
    String userId = "user-2";
    List<Notification> ordered =
        List.of(
            notification(userId, UUID.randomUUID(), "Travel"),
            notification(userId, UUID.randomUUID(), "Dining"));
    when(repository.findByUserIdOrderedByUnreadFirst(userId)).thenReturn(ordered);

    List<Notification> result = service.listForUser(userId);

    assertThat(result).isSameAs(ordered);
    verify(repository).findByUserIdOrderedByUnreadFirst(userId);
    verifyNoInteractions(streamService);
  }

  @Test
  void markAsReadSetsReadAtAndSavesOwnedNotification() {
    String userId = "user-3";
    UUID notificationId = UUID.randomUUID();
    Notification notification = notification(userId, notificationId, "Utilities");
    when(repository.findByIdAndUserId(notificationId, userId))
        .thenReturn(Optional.of(notification));
    when(repository.save(any(Notification.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    LocalDateTime before = LocalDateTime.now();
    Notification result = service.markAsRead(userId, notificationId);
    LocalDateTime after = LocalDateTime.now();

    assertThat(result).isSameAs(notification);
    assertThat(result.getReadAt()).isBetween(before, after);
    verify(repository).save(notification);
    verifyNoInteractions(streamService);
  }

  @Test
  void markAsReadRejectsMissingOrOtherUsersNotification() {
    String userId = "user-4";
    UUID notificationId = UUID.randomUUID();
    when(repository.findByIdAndUserId(notificationId, userId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.markAsRead(userId, notificationId))
        .isInstanceOf(NotificationNotFoundException.class)
        .hasMessage("Notification not found");

    verify(repository).findByIdAndUserId(notificationId, userId);
    verify(repository, never()).save(any());
    verifyNoInteractions(streamService);
  }

  private static Notification notification(String userId, UUID id, String categoryName) {
    Notification notification =
        new Notification(
            userId,
            UUID.randomUUID(),
            categoryName,
            80,
            new BigDecimal("83.33"),
            new BigDecimal("50.00"));
    notification.setId(id);
    return notification;
  }
}
