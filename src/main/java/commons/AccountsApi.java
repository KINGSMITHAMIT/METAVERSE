package commons;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.*;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
class AccountsApi {
    record Credentials(String username, String password) {}
    private final Accounts accounts;
    private final BCryptPasswordEncoder passwords;
    private final DaoAuthenticationProvider auth;
    private final HttpSessionSecurityContextRepository sessions;

    AccountsApi(Accounts accounts, BCryptPasswordEncoder passwords, DaoAuthenticationProvider auth,
                HttpSessionSecurityContextRepository sessions) {
        this.accounts = accounts;
        this.passwords = passwords;
        this.auth = auth;
        this.sessions = sessions;
    }

    @GetMapping("/csrf") Map<String, String> csrf(CsrfToken token) {
        return Map.of("token", token.getToken());
    }

    @GetMapping("/me") Map<String, String> me(Principal principal) {
        return Map.of("username", principal.getName());
    }

    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    void register(@RequestBody Credentials input) {
        if (input.username == null || !input.username.matches("[a-z0-9][a-z0-9_-]{2,23}")
            || input.password == null || input.password.length() < 8
            || input.password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use 3–24 lowercase account characters and a password of 8–72 bytes.");
        }
        if (accounts.insert(input.username, passwords.encode(input.password)) == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That account name is taken.");
        }
    }

    @PostMapping("/login") Map<String, String> login(@RequestBody Credentials input,
                                                     HttpServletRequest request, HttpServletResponse response) {
        try {
            var authentication = auth.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(input.username, input.password));
            request.getSession();
            request.changeSessionId();
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            sessions.saveContext(context, request, response);
            return Map.of("username", authentication.getName());
        } catch (AuthenticationException | IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account name or password did not match.");
        }
    }
}
