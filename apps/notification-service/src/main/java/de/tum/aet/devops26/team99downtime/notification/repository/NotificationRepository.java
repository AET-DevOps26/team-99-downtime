package de.tum.aet.devops26.team99downtime.notification.repository;

import de.tum.aet.devops26.team99downtime.notification.domain.Notification;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

  Optional<Notification> findByIdAndUserId(UUID id, String userId);

  @Query(
      "SELECT n FROM Notification n WHERE n.userId = :userId "
          + "ORDER BY CASE WHEN n.readAt IS NULL THEN 0 ELSE 1 END ASC, n.createdAt DESC")
  List<Notification> findByUserIdOrderedByUnreadFirst(@Param("userId") String userId);
}
