package commons;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
class Rooms {
    record Player(String username, int x, int y) {}
    record Event(int v, String type, Object data) {
        Event(String type, Object data) { this(1, type, data); }
    }
    interface Peer {
        void send(Event event);
        void close(int code);
    }
    private static final int RANGE = 6;
    private static final long MOVE_NANOS = 85_000_000;
    private static final long HEARTBEAT_NANOS = 25_000_000_000L;

    private final CampusMap map;
    private final boolean nearby;
    private final Map<UUID, Room> rooms = new ConcurrentHashMap<>();

    Rooms(CampusMap map, @Value("${campus.position-mode}") String mode) {
        this.map = map;
        this.nearby = switch (mode) {
            case "broadcast" -> false;
            case "nearby" -> true;
            default -> throw new IllegalArgumentException("POSITION_MODE must be broadcast or nearby");
        };
    }

    synchronized Room acquire(UUID id) {
        return rooms.computeIfAbsent(id, ignored -> new Room());
    }

    Room existing(UUID id) { return rooms.get(id); }

    // The room monitor is the only writer of positions, visibility, and peer ownership.
    final class Room {
        private final Map<String, Slot> players = new HashMap<>();
        private final Grid grid = new Grid();
        private final Map<String, Player> recent = new HashMap<>();
        private long nextVisit;

        synchronized void join(String user, Peer peer) {
            var previous = players.get(user);
            var position = previous == null ? recent.remove(user) : previous.position;
            if (position == null) position = new Player(user, map.spawnX, map.spawnY);
            var slot = new Slot(peer, position);
            if (previous != null) {
                slot.lastMove = previous.lastMove;
                slot.visit = previous.visit;
                previous.peer.close(4001);
            }
            if (previous == null && map.meeting(position.x, position.y)) slot.visit = ++nextVisit;
            players.put(user, slot);
            if (nearby) grid.put(position);
            peer.send(new Event("snapshot", Map.of("you", user, "players", visible(position).stream()
                .map(name -> players.get(name).position).toList())));
            if (previous == null) {
                for (String name : visible(position)) {
                    if (!name.equals(user)) players.get(name).peer.send(new Event("upsert", position));
                }
            }
        }

        synchronized void message(String user, Peer peer, JsonNode message) {
            var slot = players.get(user);
            if (slot == null || slot.peer != peer) return;
            if (message.path("v").asInt(-1) != 1) {
                peer.close(1002);
                return;
            }
            switch (message.path("type").asText()) {
                case "ping" -> {
                    slot.lastSeen = System.nanoTime();
                    peer.send(new Event("pong", Map.of()));
                }
                case "move" -> move(slot, message);
                default -> peer.close(1002);
            }
        }

        private void move(Slot slot, JsonNode message) {
            long now = System.nanoTime();
            if (now - slot.lastMove < MOVE_NANOS) return;
            slot.lastMove = now;
            var before = slot.position;
            var delta = switch (message.path("direction").asText()) {
                case "up" -> new int[] {0, -1};
                case "down" -> new int[] {0, 1};
                case "left" -> new int[] {-1, 0};
                case "right" -> new int[] {1, 0};
                default -> new int[] {0, 0};
            };
            var after = new Player(before.username, before.x + delta[0], before.y + delta[1]);
            if (before.equals(after) || !map.walkable(after.x, after.y)) {
                slot.peer.send(new Event("blocked", before));
                return;
            }
            var oldVisible = nearby ? visible(before) : Set.<String>of();
            if (!map.meeting(after.x, after.y)) slot.visit = 0;
            else if (slot.visit == 0) slot.visit = ++nextVisit;
            slot.position = after;
            if (nearby) grid.move(before, after);
            var newVisible = visible(after);
            var stamp = message.path("sentAt");
            var update = new Event("position", new Movement(after, stamp.isIntegralNumber() ? stamp.asLong() : null));
            for (String observer : newVisible) {
                var other = players.get(observer);
                if (nearby && !oldVisible.contains(observer)) {
                    slot.peer.send(new Event("upsert", other.position));
                }
                other.peer.send(update);
            }
            for (String observer : oldVisible) {
                if (!newVisible.contains(observer)) {
                    players.get(observer).peer.send(new Event("leave", before.username));
                    slot.peer.send(new Event("leave", observer));
                }
            }
        }

        synchronized void leave(String user, Peer peer) {
            var slot = players.get(user);
            if (slot == null || slot.peer != peer) return;
            var visible = visible(slot.position);
            players.remove(user);
            if (nearby) grid.remove(slot.position);
            recent.put(user, slot.position);
            for (String name : visible) {
                if (!name.equals(user)) players.get(name).peer.send(new Event("leave", user));
            }
        }

        synchronized void reap() {
            long now = System.nanoTime();
            for (var slot : List.copyOf(players.values())) {
                if (now - slot.lastSeen > HEARTBEAT_NANOS) {
                    slot.peer.close(4000);
                    leave(slot.position.username, slot.peer);
                }
            }
        }

        synchronized long meetingVisit(String user) {
            var slot = players.get(user);
            return slot == null ? 0 : slot.visit;
        }

        private Set<String> visible(Player player) {
            if (!nearby) return new HashSet<>(players.keySet());
            var names = grid.around(player);
            names.removeIf(name -> {
                var other = players.get(name).position;
                return Math.abs(player.x - other.x) > RANGE || Math.abs(player.y - other.y) > RANGE;
            });
            return names;
        }
    }

    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 5000)
    void reap() { rooms.values().forEach(Room::reap); }

    record Movement(Player player, Long sentAt) {}

    private static final class Slot {
        final Peer peer;
        Player position;
        long visit;
        long lastMove = System.nanoTime() - MOVE_NANOS;
        long lastSeen = System.nanoTime();

        Slot(Peer peer, Player position) { this.peer = peer; this.position = position; }
    }

    private static final class Grid {
        record Cell(int x, int y) {
            Cell(Player player) { this(player.x / RANGE, player.y / RANGE); }
        }
        private final Map<Cell, Set<String>> buckets = new HashMap<>();
        void put(Player player) {
            buckets.computeIfAbsent(new Cell(player), ignored -> new HashSet<>()).add(player.username);
        }
        void remove(Player player) {
            var cell = new Cell(player);
            var names = buckets.get(cell);
            names.remove(player.username);
            if (names.isEmpty()) buckets.remove(cell);
        }
        void move(Player before, Player after) {
            if (!new Cell(before).equals(new Cell(after))) {
                remove(before);
                put(after);
            }
        }
        Set<String> around(Player player) {
            var result = new HashSet<String>();
            var cell = new Cell(player);
            for (int x = cell.x - 1; x <= cell.x + 1; x++) {
                for (int y = cell.y - 1; y <= cell.y + 1; y++) {
                    result.addAll(buckets.getOrDefault(new Cell(x, y), Set.of()));
                }
            }
            return result;
        }
    }
}
