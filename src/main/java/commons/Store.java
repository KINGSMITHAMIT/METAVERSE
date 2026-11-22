package commons;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.LockModeType;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;

@Entity @Table(name = "accounts")
class Account {
    @Id String username;
    String passwordHash;

    protected Account() {}

    Account(String username, String passwordHash) {
        this.username = username;
        this.passwordHash = passwordHash;
    }
}

@Entity @Table(name = "workspaces")
class Workspace {
    @Id UUID id;
    String title;
    String owner;
    String mapKey;

    protected Workspace() {}

    Workspace(String title, String owner) {
        this.id = UUID.randomUUID();
        this.title = title;
        this.owner = owner;
        this.mapKey = "commons-v1";
    }
}

@Entity @Table(name = "members")
class Member {
    @Id UUID id;
    UUID workspaceId;
    String username;
    boolean voiceBlocked;

    protected Member() {}

    Member(UUID workspaceId, String username) {
        this.id = UUID.randomUUID();
        this.workspaceId = workspaceId;
        this.username = username;
    }
}

@Entity @Table(name = "invitations")
class Invitation {
    @Id UUID id;
    UUID workspaceId;
    String invitee;
    Instant expiresAt;
    boolean consumed;

    protected Invitation() {}

    Invitation(UUID workspaceId, String invitee) {
        this.id = UUID.randomUUID();
        this.workspaceId = workspaceId;
        this.invitee = invitee;
        this.expiresAt = Instant.now().plusSeconds(3600);
    }
}

interface Accounts extends JpaRepository<Account, String> {
    @Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query(value = "insert into accounts values (:username, :hash) on conflict do nothing", nativeQuery = true)
    int insert(String username, String hash);
}
interface Workspaces extends JpaRepository<Workspace, UUID> {
    @Query("select w from Workspace w, Member m where m.workspaceId = w.id and m.username = :username order by w.title")
    List<Workspace> visible(String username);
}
interface Members extends JpaRepository<Member, UUID> {
    Optional<Member> findByWorkspaceIdAndUsername(UUID workspaceId, String username);
    List<Member> findByWorkspaceIdOrderByUsername(UUID workspaceId);
    @Modifying
    @Query(value = "insert into members values (:id, :workspaceId, :username, false) on conflict do nothing", nativeQuery = true)
    void add(UUID id, UUID workspaceId, String username);
    @Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query("update Member m set m.voiceBlocked = true where m.workspaceId = :workspaceId and m.username = :username")
    int blockVoice(UUID workspaceId, String username);
}
interface Invitations extends JpaRepository<Invitation, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invitation i where i.id = :id")
    Optional<Invitation> lock(UUID id);
}
