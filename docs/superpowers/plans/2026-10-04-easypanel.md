# EasyPanel migration
Goal: deploy monthly Saldo app to allexbonilha/bluepayplanner and isolated EasyPanel project.
Architecture: Next.js standalone Docker, PostgreSQL JSONB owner record with optimistic revision concurrency, fail-closed HTTP Basic Auth using runtime secrets. Preserve original Sites deployment.
Tasks:
- [ ] Tests first for HTTP auth and concurrent portfolio persistence.
- [ ] PostgreSQL repository and same API contract, protected proxy and health route.
- [ ] Docker, lockfile, documentation and validation build.
- [ ] Publish source, configure new app/database on EasyPanel and auto deploy.
- [ ] Verify deployment; user enters private access credential, then migrate existing records after protected destination is verified.
No secrets, user records or local tool state in GitHub. No modifications to other EasyPanel projects.
