package de.tum.aet.devops26.team99downtime.notification.service;

import de.tum.aet.devops26.team99downtime.notification.dto.NotificationResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class NotificationStreamService {

  private static final Logger LOG = LoggerFactory.getLogger(NotificationStreamService.class);
  private static final long SSE_TIMEOUT_MS = 5 * 60 * 1000L; // 5 minutes

  private final ConcurrentHashMap<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

  public SseEmitter subscribe(String userId) {
    SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
    emitters.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(emitter);
    emitter.onCompletion(() -> remove(userId, emitter));
    emitter.onTimeout(() -> remove(userId, emitter));
    emitter.onError(ex -> remove(userId, emitter));
    return emitter;
  }

  public void push(String userId, NotificationResponse notification) {
    List<SseEmitter> userEmitters = emitters.getOrDefault(userId, List.of());
    List<SseEmitter> dead = new ArrayList<>();

    for (SseEmitter emitter : userEmitters) {
      try {
        emitter.send(
            SseEmitter.event().name("notification").data(notification, MediaType.APPLICATION_JSON));
      } catch (IOException e) {
        dead.add(emitter);
      }
    }
    dead.forEach(e -> remove(userId, e));
    if (!dead.isEmpty()) {
      LOG.debug("Removed {} dead emitter(s) for user {}", dead.size(), userId);
    }
  }

  private void remove(String userId, SseEmitter emitter) {
    emitters.computeIfPresent(
        userId,
        (key, userEmitters) -> {
          userEmitters.remove(emitter);
          return userEmitters.isEmpty() ? null : userEmitters;
        });
  }
}
