const { PrismaClient } = require('@prisma/client');

// Secret columns are stripped here, at the client layer, instead of per query. Prisma's
// `include: { users: true }` / `include: { devices: true }` means SELECT * on the joined
// table, so any one of the ~10 such includes in this codebase would otherwise put these
// hashes straight into an API response. Omitting them once here makes that impossible.
// A query that genuinely needs one opts back in with `omit: { <column>: false }` — there
// is exactly one such place, auth.service.signIn.
const prisma = new PrismaClient({
  omit: {
    users: { password_hash: true },
    devices: { api_key_hash: true },
  },
});

module.exports = prisma;