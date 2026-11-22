package commons;

import org.springframework.context.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;

@Configuration(proxyBeanMethods = false)
class Security {
    @Bean BCryptPasswordEncoder passwords() {
        return new BCryptPasswordEncoder();
    }

    @Bean DaoAuthenticationProvider provider(Accounts accounts, BCryptPasswordEncoder encoder) {
        var provider = new DaoAuthenticationProvider(username -> accounts.findById(username)
            .map(account -> User.withUsername(username).password(account.passwordHash).roles("STUDENT").build())
            .orElseThrow(() -> new UsernameNotFoundException(username)));
        provider.setPasswordEncoder(encoder);
        return provider;
    }

    @Bean HttpSessionSecurityContextRepository sessions() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean SecurityFilterChain filter(HttpSecurity http, DaoAuthenticationProvider provider,
                                     HttpSessionSecurityContextRepository sessions) throws Exception {
        return http.authenticationProvider(provider)
            .securityContext(config -> config.securityContextRepository(sessions))
            .csrf(config -> config.csrfTokenRepository(new HttpSessionCsrfTokenRepository()))
            .exceptionHandling(errors -> errors.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/", "/assets/**", "/index.html", "/actuator/health", "/api/csrf",
                    "/api/register", "/api/login", "/error").permitAll()
                .anyRequest().authenticated())
            .logout(logout -> logout.logoutUrl("/api/logout").logoutSuccessHandler(
                (request, response, authentication) -> response.setStatus(204)))
            .build();
    }
}
