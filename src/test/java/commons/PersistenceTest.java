package commons;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Testcontainers
class PersistenceTest {
    @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", DB::getJdbcUrl);
        properties.add("spring.datasource.username", DB::getUsername);
        properties.add("spring.datasource.password", DB::getPassword);
    }

    @Autowired Accounts accounts;
    @Autowired Members members;
    @Autowired Invitations invitations;
    @Autowired WorkspaceApi api;

    @Test void accountCannotBeOverwrittenAndInvitesAreBoundSingleUseAndExpire() {
        assertThat(accounts.insert("alice", "original")).isEqualTo(1);
        assertThat(accounts.insert("alice", "replacement")).isZero();
        assertThat(accounts.findById("alice").orElseThrow().passwordHash).isEqualTo("original");
        accounts.insert("bob", "original");
        accounts.insert("charlie", "original");
        UUID workspace = api.create(() -> "alice", new WorkspaceApi.Name("Research")).id();
        var invite = api.invite(() -> "alice", workspace, new WorkspaceApi.Target("bob"));
        assertThrown(() -> api.accept(() -> "charlie", new WorkspaceApi.Accept(invite.code())));
        api.accept(() -> "bob", new WorkspaceApi.Accept(invite.code()));
        assertThat(api.list(() -> "bob")).extracting(WorkspaceApi.Summary::id).containsExactly(workspace);
        assertThrown(() -> api.accept(() -> "bob", new WorkspaceApi.Accept(invite.code())));
        var expired = new Invitation(workspace, "charlie");
        expired.expiresAt = Instant.now().minusSeconds(1);
        invitations.save(expired);
        assertThrown(() -> api.accept(() -> "charlie", new WorkspaceApi.Accept(expired.id)));
        assertThat(members.findByWorkspaceIdAndUsername(workspace, "charlie")).isEmpty();
    }

    private static void assertThrown(Runnable action) {
        assertThatThrownBy(action::run).isInstanceOf(ResponseStatusException.class);
    }
}
