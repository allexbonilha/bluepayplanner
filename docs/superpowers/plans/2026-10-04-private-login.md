# Private owner login

Replace HTTP Basic with a Portuguese mobile-friendly blue login page, reusing the existing server credentials. No public registration. Protect financial APIs and the rendered app with server-validated opaque sessions, hashed token storage in PostgreSQL, secure HttpOnly cookies, 30-minute idle and 8-hour absolute expiration, credential-change invalidation, logout revocation, shared database rate limits, exact Origin validation and security headers.

1. Write meaningful credential/session/CSRF tests and observe failure.
2. Implement database session and rate-limit storage, login/logout endpoints and server guards.
3. Build accessible login UI, logout and expired-session handling preserving unsaved fields.
4. Run tests, type checking, build, security review, deploy via GitHub and check production without altering financial records.
