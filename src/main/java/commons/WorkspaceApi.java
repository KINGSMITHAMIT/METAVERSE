package commons;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workspaces")
class WorkspaceApi {
    record Summary(UUID id, String title, String owner) {
        Summary(Workspace workspace) {
            this(workspace.id, workspace.title, workspace.owner);
        }
    }
    record Name(String title) {}
    record Target(String username) {}
    record Invite(UUID code, Instant expiresAt) {}
    record Person(String username, boolean voiceBlocked) {}
    record Details(Summary workspace, String mapKey, int width, int height, List<CampusMap.Rect> walls,
                   List<CampusMap.Rect> tables, CampusMap.Rect meeting, List<Person> members) {}
    record Accept(UUID code) {}

    private final Workspaces workspaces;
    private final Members members;
    private final Invitations invitations;
    private final CampusMap map;
    private final Voice voice;

    WorkspaceApi(Workspaces workspaces, Members members, Invitations invitations, CampusMap map, Voice voice) {
        this.workspaces = workspaces;
        this.members = members;
        this.invitations = invitations;
        this.map = map;
        this.voice = voice;
    }

    @GetMapping List<Summary> list(Principal user) {
        return workspaces.visible(user.getName()).stream().map(Summary::new).toList();
    }

    @PostMapping @Transactional @ResponseStatus(HttpStatus.CREATED)
    Summary create(Principal user, @RequestBody Name input) {
        if (input.title == null || input.title.isBlank() || input.title.strip().length() > 60) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a title up to 60 characters.");
        }
        var workspace = workspaces.saveAndFlush(new Workspace(input.title.strip(), user.getName()));
        members.add(UUID.randomUUID(), workspace.id, user.getName());
        return new Summary(workspace);
    }

    @GetMapping("/{id}") Details details(Principal user, @PathVariable UUID id) {
        requireMember(id, user.getName());
        var workspace = workspaces.findById(id).orElseThrow();
        return new Details(new Summary(workspace), workspace.mapKey, map.width, map.height, map.walls, map.tables,
            map.meeting, members.findByWorkspaceIdOrderByUsername(id).stream()
                .map(member -> new Person(member.username, member.voiceBlocked)).toList());
    }

    @PostMapping("/{id}/invites") @ResponseStatus(HttpStatus.CREATED)
    Invite invite(Principal user, @PathVariable UUID id, @RequestBody Target input) {
        requireOwner(id, user);
        if (input.username == null || !input.username.matches("[a-z0-9][a-z0-9_-]{2,23}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter the teammate's account name.");
        }
        var invite = invitations.save(new Invitation(id, input.username));
        return new Invite(invite.id, invite.expiresAt);
    }

    @PostMapping("/accept") @Transactional
    Summary accept(Principal user, @RequestBody Accept input) {
        if (input.code == null) throw denied();
        var invitation = invitations.lock(input.code).orElseThrow(WorkspaceApi::denied);
        if (invitation.consumed || !invitation.invitee.equals(user.getName())
                || !invitation.expiresAt.isAfter(Instant.now())) throw denied();
        invitation.consumed = true;
        members.add(UUID.randomUUID(), invitation.workspaceId, user.getName());
        return new Summary(workspaces.findById(invitation.workspaceId).orElseThrow());
    }

    @PostMapping("/{id}/voice") Voice.Ticket voice(Principal user, @PathVariable UUID id) {
        return voice.issue(id, user.getName());
    }

    @DeleteMapping("/{id}/voice/{username}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void removeVoice(Principal user, @PathVariable UUID id, @PathVariable String username) {
        requireOwner(id, user);
        if (username.equals(user.getName())) throw denied();
        voice.block(id, username);
    }

    private void requireOwner(UUID id, Principal user) {
        if (!workspaces.findById(id).map(workspace -> workspace.owner.equals(user.getName())).orElse(false)) {
            throw denied();
        }
    }

    private void requireMember(UUID id, String user) {
        if (members.findByWorkspaceIdAndUsername(id, user).isEmpty()) throw denied();
    }

    static ResponseStatusException denied() {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, "You don't have access.");
    }
}
