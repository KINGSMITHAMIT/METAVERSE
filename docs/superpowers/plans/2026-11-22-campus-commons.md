# Campus Commons implementation plan

Use Spring Boot for authenticated HTTP, durable PostgreSQL records, and one serialized state owner per room. React renders the controls and Phaser renders an original shared map. LiveKit handles microphone tracks. The attached product brief is the specification.

- [x] Establish Maven and npm builds, Compose dependencies and a Flyway schema. Verify service health and migration.
- [x] Add session and CSRF protection, workspace creation and expiring invitations. Verify authorization with PostgreSQL-backed tests.
- [x] Add a versioned socket protocol with collision checks, bounded outbound queues and replacement-safe reconnect. Exercise these behaviors with two browser sessions.
- [x] Issue short-lived voice tokens only inside the meeting zone. Remove participants on exit or host removal. Exercise real audio and explicitly probe cached credentials.
- [x] Add grid-based visibility alongside broadcast. Run the same workloads in both modes and record delivered updates, timing, CPU and reconnect observations.
- [x] Document fresh setup and limitations and run CI-equivalent checks.

Open acceptance check: self-hosted LiveKit accepted a cached credential after removal in the strict probe.
