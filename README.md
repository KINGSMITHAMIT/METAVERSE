# Campus Commons

[Open the live KIIT campus preview](https://kingsmithamit.github.io/METAVERSE/)

Campus Commons is a browser-based 2D project space for student teams. Create a workspace, invite a teammate, and meet on an original campus map. The lobby and project tables are open to members. The private meeting zone has opt-in audio.

## Explore KIIT University

The landing page is a geographic campus explorer for KIIT in Bhubaneswar. Choose **Walk** to follow mapped roads with an avatar. Drag or pinch the map, choose **Landmarks** to visit a named site, or open **360° tours** to search 519 university-hosted panoramas. On a keyboard, focus the map to pan with WASD or arrows and press / to search. The map runs with the frontend alone. The panoramas require an internet connection.

The atlas draws on OpenStreetMap, Microsoft building footprints and ESA WorldCover. The [atlas source notes](docs/kiit-atlas.md) document coverage, attribution and regeneration.

Use `npm run build:preview` in `frontend` to produce a static build with relative asset paths. Its team workspace offers the room directory and floor plans. The full application adds sign-in, invitations and live voice.

## Run the demo

Use Java 21 (the JDK), Node.js 22 or later, and Docker with Compose. From the repository root:

```sh
docker compose up -d --wait
LIVEKIT_API_URL=http://127.0.0.1:7880 LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=secret ./mvnw spring-boot:run
```

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173` in two independent browser profiles, such as a regular and a private window. Choose **Team workspace**, then **Create an account** in each and choose different lowercase usernames and passwords of at least eight characters. In the first profile, create a workspace and generate an invitation for the second username. Copy the single-use code to the second profile and join. Move either avatar with WASD, the arrow keys, or the on-screen buttons. The other profile should see it move. Switch between the isometric diorama and floor plan above the map. Select a room in the directory to zoom in, or choose **Reset view** for the full building. A duplicate tab for the same account takes over that account’s avatar.

For voice, walk both players through the opening on the left wall of the private room. The route from the spawn at `(6, 12)` is six tiles up and fifteen right, ending at `(21, 6)`. Click **Join voice** in both browsers and grant microphone access. Leave the zone to disconnect. The workspace owner can choose **Remove from voice** in **Manage teammates**. Open the demo with loopback URLs for browser microphone permissions. The Compose credentials are for local development.

You can also build the frontend and backend into one app image:

```sh
docker compose --profile app up -d --build --wait
```

In that mode use `http://localhost:8080`. Actuator readiness is at `/actuator/health`. `docker compose --profile app down` stops the local services and preserves PostgreSQL data.

## Architecture

- **HTTP and persistence.** Spring MVC serves the JSON API and Spring Security stores login state in a server-side session. Mutating requests require a CSRF token. BCrypt protects stored passwords. Spring Data JPA and Flyway maintain accounts, workspaces, single-use invitations, memberships, voice blocks, and map metadata in PostgreSQL. Invitations expire after one hour and are usable only by the named account. The original map geometry is versioned in Java and served to workspace members.
- **Room state.** A Spring WebSocket handshake requires a live session, workspace membership, and an exact allowed origin. Each room monitor serializes changes to its state. Clients send cardinal movement intent with protocol version `1`. Java applies an 85 ms per-player movement floor, map bounds, and collision checks. A bounded queue and one virtual-thread writer per connection isolate slow recipients from room updates. Heartbeats remove idle peers. Replacement verifies connection identity before releasing the avatar, so an old connection closing cannot remove the new one.
- **Synchronization.** The server sends a fresh visibility-scoped snapshot after reconnect. Normal reconnect keeps the last position in the current Java process. A Java restart clears positions and sessions. Sign in again and rejoin to spawn in the lobby. Workspace data, invitations, and host voice blocks survive the restart.
- **Voice.** Java checks durable membership, voice blocks, and the current server-confirmed visit to the private zone before issuing a 20-second, microphone-only LiveKit token. The browser activates its microphone after an explicit join. Leaving invalidates that visit. Host removal persists a workspace-level voice block and the server calls LiveKit to disconnect the participant. The app denies new tokens immediately once that block commits.
- **Delivery modes.** Set `POSITION_MODE=broadcast` for room-wide movement or `POSITION_MODE=nearby` to deliver to players within six tiles on each axis. The latter queries a spatial grid and sends visibility changes on boundary crossings. One Spring Boot instance owns all rooms. Redis, multi-node room ownership, and Kubernetes are outside this version.

### Voice revocation status

Two Chromium sessions exchanged microphone tracks with the local self-hosted LiveKit v1.9.11 instance. The browser disconnected on zone exit, LiveKit disconnected the host-removed participant, and Java denied fresh token requests. The self-hosted server accepted an unexpired token issued before removal. **Strict revocation remains open**. The Compose voice demo is for local use. A deployment enforcing private voice must reject previously issued and SFU-refreshed credentials after permission removal.

## Checks

```sh
./mvnw verify
cd frontend
npm ci
npm run build
npx playwright install --with-deps chromium
VOICE_E2E=1 npm run test:e2e
```

The browser tests expect the running Vite and Spring Boot development stack. Set `CHROMIUM_PATH` to use an installed Chromium. Maven tests require Docker for the PostgreSQL Testcontainer. GitHub Actions runs the builds, backend tests, and browser checks, including opt-in voice, disconnect on removal, and denial of new voice tickets.

The [benchmark report](bench/RESULTS.md) records the local k6 commands, measured results, and trade-offs for the two delivery modes.

The [2D metaverse tutorial repository](https://github.com/hkirat/2d-metaverse/) informed the split between workspace APIs and live rooms. Campus Commons uses an independent Java implementation and original map artwork drawn in Phaser.
