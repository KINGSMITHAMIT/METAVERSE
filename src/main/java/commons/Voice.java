package commons;

import io.livekit.server.*;
import java.io.IOException;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
class Voice {
    record Ticket(String url, String token) {}
    private record Participant(UUID workspace, String username) {}
    private record Grant(long visit) {}
    private static final long TOKEN_MILLIS = 20_000;
    private final System.Logger log = System.getLogger(Voice.class.getName());
    private final Members members;
    private final Rooms rooms;
    private final String url;
    private final String apiKey;
    private final String secret;
    private final RoomServiceClient service;
    private final Map<Participant, Grant> grants = new ConcurrentHashMap<>();

    Voice(Members members, Rooms rooms,
          @Value("${campus.livekit.api-url}") String apiUrl,
          @Value("${campus.livekit.browser-url}") String url,
          @Value("${campus.livekit.key}") String apiKey,
          @Value("${campus.livekit.secret}") String secret) {
        this.members = members;
        this.rooms = rooms;
        this.url = url;
        this.apiKey = apiKey;
        this.secret = secret;
        this.service = apiUrl.isBlank() || apiKey.isBlank() || secret.isBlank() ? null
            : RoomServiceClient.create(apiUrl, apiKey, secret, false, builder ->
                builder.callTimeout(2, TimeUnit.SECONDS));
    }

    Ticket issue(UUID id, String user) {
        var room = rooms.existing(id);
        if (room == null) throw WorkspaceApi.denied();
        synchronized (room) {
            long visit = room.meetingVisit(user);
            if (visit == 0 || members.findByWorkspaceIdAndUsername(id, user).map(member -> member.voiceBlocked).orElse(true)) {
                throw WorkspaceApi.denied();
            }
            if (service == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Voice is offline.");
            var participant = new Participant(id, user);
            var previous = grants.putIfAbsent(participant, new Grant(visit));
            if (previous != null && previous.visit != visit) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Previous voice session is closing.");
            }
            var token = new AccessToken(apiKey, secret);
            token.setIdentity(user);
            token.setExpiration(new Date(System.currentTimeMillis() + TOKEN_MILLIS));
            token.addGrants(new RoomJoin(true), new RoomName(mediaRoom(id)), new CanPublish(true),
                new CanPublishSources(List.of("microphone")), new CanSubscribe(true), new CanPublishData(false));
            return new Ticket(url, token.toJwt());
        }
    }

    void block(UUID id, String user) {
        var room = rooms.acquire(id);
        synchronized (room) {
            if (members.blockVoice(id, user) == 0) throw WorkspaceApi.denied();
            if (service != null) grants.put(new Participant(id, user), new Grant(0));
        }
    }

    @Scheduled(fixedDelay = 500)
    void reconcile() {
        if (service == null) return;
        grants.forEach((participant, grant) -> {
            var room = rooms.existing(participant.workspace);
            if (grant.visit > 0 && room != null && grant.visit == room.meetingVisit(participant.username)) return;
            try {
                var response = service.removeParticipant(mediaRoom(participant.workspace), participant.username).execute();
                if (response.errorBody() != null) response.errorBody().close();
                if (response.isSuccessful() || response.code() == 404) {
                    grants.remove(participant, grant);
                } else {
                    log.log(System.Logger.Level.WARNING, "LiveKit removal returned HTTP " + response.code());
                }
            } catch (IOException exception) {
                log.log(System.Logger.Level.WARNING, "LiveKit removal request failed; will retry");
            }
        });
    }

    private static String mediaRoom(UUID workspace) { return workspace + "-meeting"; }
}
