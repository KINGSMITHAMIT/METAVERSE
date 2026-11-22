package commons;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class CampusMapTest {
    @Test void wallsAndBoundsRejectWalkingButDoorRemainsOpen() {
        var map = new CampusMap();
        assertThat(map.walkable(20, 3)).isFalse();
        assertThat(map.walkable(20, 6)).isTrue();
        assertThat(map.walkable(0, 5)).isFalse();
        assertThat(map.walkable(-1, 0)).isFalse();
        assertThat(map.meeting(21, 6)).isTrue();
        assertThat(map.meeting(20, 6)).isFalse();
    }
}
