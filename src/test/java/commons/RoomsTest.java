package commons;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class RoomsTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test void gridCrossingAndReconnectUseCurrentVisibility() throws InterruptedException {
        var room = new Rooms(new CampusMap(), "nearby").acquire(UUID.randomUUID());
        var alice = new Peer();
        var bob = new Peer();
        room.join("alice", alice);
        room.join("bob", bob);
        move(room, "alice", alice, "left", 5);
        move(room, "bob", bob, "right", 2);
        assertThat(alice.events).anyMatch(event -> event.type().equals("leave") && event.data().equals("bob"));
        assertThat(bob.events).anyMatch(event -> event.type().equals("leave") && event.data().equals("alice"));

        room.leave("bob", bob);
        var replacement = new Peer();
        room.join("bob", replacement);
        assertThat(json.valueToTree(replacement.events.getFirst()).path("data").path("players").size()).isEqualTo(1);
        move(room, "bob", replacement, "left", 1);
        assertThat(replacement.events).anyMatch(event -> event.type().equals("upsert")
            && event.data().equals(new Rooms.Player("alice", 1, 12)));
        assertThat(alice.events).anyMatch(event -> event.type().equals("position")
            && event.data().equals(new Rooms.Movement(new Rooms.Player("bob", 7, 12), null)));
    }

    @Test void closingAnOldPeerDoesNotRemoveReplacementAvatar() {
        var room = new Rooms(new CampusMap(), "broadcast").acquire(UUID.randomUUID());
        var old = new Peer();
        var replacement = new Peer();
        var observer = new Peer();
        room.join("alice", old);
        room.join("alice", replacement);
        assertThat(old.closed).isEqualTo(4001);
        room.leave("alice", old);
        room.join("bob", observer);
        assertThat(json.valueToTree(observer.events.getFirst()).path("data").path("players").size()).isEqualTo(2);
    }

    private void move(Rooms.Room room, String username, Peer peer, String direction, int steps)
            throws InterruptedException {
        for (int i = 0; i < steps; i++) {
            room.message(username, peer, json.valueToTree(Map.of("v", 1, "type", "move", "direction", direction)));
            Thread.sleep(90);
        }
    }

    private static final class Peer implements Rooms.Peer {
        final List<Rooms.Event> events = new ArrayList<>();
        int closed;

        @Override public void send(Rooms.Event event) { events.add(event); }
        @Override public void close(int code) { closed = code; }
    }
}
