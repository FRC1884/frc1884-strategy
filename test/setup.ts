// Each test file gets its own in-memory database and known sign-in codes.
process.env.DATABASE_PATH = ":memory:";
process.env.SCOUT_CODE = "scout-code";
process.env.MANAGER_CODE = "manager-code";
process.env.STRATEGIST_CODE = "strategist-code";
process.env.LEAD_CODE = "lead-code";
process.env.SESSION_SECRET = "test-secret-test-secret-test-secret";
delete process.env.TBA_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
