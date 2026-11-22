package commons;

import java.util.List;
import org.springframework.stereotype.Component;

@Component
class CampusMap {
    record Rect(int x, int y, int width, int height) {
        boolean contains(int px, int py) {
            return px >= x && py >= y && px < x + width && py < y + height;
        }
    }

    final int width = 30;
    final int height = 18;
    final int spawnX = 6;
    final int spawnY = 12;
    final Rect meeting = new Rect(21, 2, 7, 7);
    final List<Rect> walls = List.of(
        new Rect(0, 0, 30, 1), new Rect(0, 17, 30, 1),
        new Rect(0, 1, 1, 16), new Rect(29, 1, 1, 16),
        new Rect(20, 1, 9, 1), new Rect(20, 2, 1, 4),
        new Rect(20, 7, 1, 3), new Rect(20, 9, 9, 1), new Rect(28, 2, 1, 7)
    );
    final List<Rect> tables = List.of(
        new Rect(13, 4, 4, 2), new Rect(13, 11, 4, 2), new Rect(23, 4, 3, 2)
    );

    boolean walkable(int x, int y) {
        return x >= 0 && y >= 0 && x < width && y < height
            && walls.stream().noneMatch(rect -> rect.contains(x, y))
            && tables.stream().noneMatch(rect -> rect.contains(x, y));
    }

    boolean meeting(int x, int y) {
        return meeting.contains(x, y);
    }
}
