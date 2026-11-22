package commons;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpSession;
import java.net.URI;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.*;
import org.springframework.stereotype.Component;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.socket.*;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

@Component
@EnableWebSocket
class CampusSocket implements WebSocketConfigurer {
    private final Members members;
    private final Rooms rooms;
    private final ObjectMapper json;
    private final String origin;

    CampusSocket(Members members, Rooms rooms, ObjectMapper json, @Value("${campus.origin}") String origin) {
        this.members = members;
        this.rooms = rooms;
        this.json = json;
        this.origin = origin;
    }

    @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(new Handler(), "/ws/campus").setAllowedOrigins(origin).addInterceptors(new Access());
    }

    private final class Access implements HandshakeInterceptor {
        @Override public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                                  WebSocketHandler handler, Map<String, Object> attributes) {
            if (!origin.equals(request.getHeaders().getOrigin()) || request.getPrincipal() == null) {
                response.setStatusCode(HttpStatus.FORBIDDEN);
                return false;
            }
            var user = request.getPrincipal().getName();
            UUID workspace;
            try {
                workspace = UUID.fromString(workspaceQuery(request.getURI()));
            } catch (IllegalArgumentException e) {
                response.setStatusCode(HttpStatus.BAD_REQUEST);
                return false;
            }
            if (members.findByWorkspaceIdAndUsername(workspace, user).isEmpty()) {
                response.setStatusCode(HttpStatus.FORBIDDEN);
                return false;
            }
            if (!(request instanceof ServletServerHttpRequest servlet)) return false;
            var httpSession = servlet.getServletRequest().getSession(false);
            if (httpSession == null) return false;
            attributes.put("httpSession", httpSession);
            attributes.put("room", rooms.acquire(workspace));
            attributes.put("user", user);
            return true;
        }

        private String workspaceQuery(URI uri) {
            var query = uri.getQuery();
            return query != null && query.startsWith("workspace=") ? query.substring(10) : "";
        }

        @Override public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                             WebSocketHandler handler, Exception exception) {}
    }

    private final class Handler extends TextWebSocketHandler {
        @Override public void afterConnectionEstablished(WebSocketSession session) {
            session.setTextMessageSizeLimit(1024);
            var peer = new SocketPeer(session);
            session.getAttributes().put("peer", peer);
            peer.room.join(peer.user, peer);
            Thread.startVirtualThread(peer::write);
        }

        @Override protected void handleTextMessage(WebSocketSession session, TextMessage message) {
            var peer = peer(session);
            if (!peer.authenticated()) {
                peer.close(4003);
                return;
            }
            try {
                var body = json.readTree(message.getPayload());
                if (body == null || !body.isObject()) {
                    peer.close(1002);
                    return;
                }
                peer.room.message(peer.user, peer, body);
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                peer.close(1002);
            }
        }

        @Override public void handleTransportError(WebSocketSession session, Throwable exception) {
            var peer = peer(session);
            if (peer != null) peer.close(1011);
        }

        @Override public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
            var peer = peer(session);
            if (peer != null) {
                peer.close(status.getCode());
                peer.room.leave(peer.user, peer);
            }
        }

        private SocketPeer peer(WebSocketSession session) {
            return (SocketPeer) session.getAttributes().get("peer");
        }
    }

    private final class SocketPeer implements Rooms.Peer {
        private static final Object STOP = new Object();
        private final WebSocketSession session;
        private final Rooms.Room room;
        private final String user;
        private final HttpSession httpSession;
        private final AtomicBoolean closing = new AtomicBoolean();
        private final ArrayBlockingQueue<Object> outbound = new ArrayBlockingQueue<>(128);

        SocketPeer(WebSocketSession session) {
            this.session = session;
            this.room = (Rooms.Room) session.getAttributes().get("room");
            this.user = (String) session.getAttributes().get("user");
            this.httpSession = (HttpSession) session.getAttributes().get("httpSession");
        }

        boolean authenticated() {
            try {
                var context = httpSession.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
                return context instanceof SecurityContext security && security.getAuthentication() != null
                    && user.equals(security.getAuthentication().getName());
            } catch (IllegalStateException invalidated) {
                return false;
            }
        }

        @Override public void send(Rooms.Event event) {
            if (!closing.get() && !outbound.offer(event)) close(1013);
        }

        @Override public void close(int code) {
            if (closing.compareAndSet(false, true)) {
                outbound.clear();
                outbound.offer(STOP);
                Thread.startVirtualThread(() -> {
                    try {
                        if (session.isOpen()) session.close(new CloseStatus(code));
                    } catch (java.io.IOException ignored) {
                        // The writer and close callback also release room ownership.
                    }
                });
            }
        }

        void write() {
            try {
                while (!closing.get()) {
                    var event = outbound.take();
                    if (event == STOP) break;
                    session.sendMessage(new TextMessage(json.writeValueAsString(event)));
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (java.io.IOException | IllegalStateException e) {
                close(1011);
            } finally {
                room.leave(user, this);
            }
        }
    }
}
