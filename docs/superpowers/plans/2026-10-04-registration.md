# Registration and isolated users

Keep the existing `owner` portfolio and bootstrap an explicit user row for APP_USERNAME (currently allex), preserving the existing password from the server environment. Public registrations receive random user IDs, salted scrypt password hashes, and independent portfolios. Tenant identity comes exclusively from a validated session, never request parameters. Sessions bind to user ID and current credential version. Changing the owner's server password invalidates owner sessions only.

- Add registration with name, unique normalized username, password and confirmation. Minimum 16 characters; bounded JSON, exact trusted origin and shared rate limiting.
- Preserve existing sessions by migrating user_id with default owner. Keep financial data revision 9 untouched.
- Bind all portfolio reads and writes to the session user. Show name/username in the app profile and add registration link to login.
- Verify credential hashing, validation, cross-user isolation, duplicate usernames, concurrent signup, owner login and migration preservation. Run full tests/build and a fresh security review before deploy. Check production with disposable test users and no writes to owner records.

Scope: no public registration receives administrative access, shared portfolios, payments or password-reset emails. Owner credential remains manageable through EasyPanel. New user portfolios start with standard categories and no monthly records or personal accounts.
