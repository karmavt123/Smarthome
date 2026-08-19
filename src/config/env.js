// Fail fast on a broken .env instead of booting a server that only breaks at the first
// request needing the missing value. dotenv is loaded HERE, before server.js requires
// ./app, because several modules read process.env at import time (auth.service.js caches
// JWT_ACCESS_SECRET that way) — validating after that point would be too late.
require('dotenv').config();

// Without any of these the app cannot function at all.
const REQUIRED = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

// A guessable secret is no better than a missing one. 32 chars is the floor;
// `crypto.randomBytes(32).toString('hex')` gives 64.
const MIN_SECRET_LENGTH = 32;

function validateEnv() {
  const problems = [];

  for (const key of REQUIRED) {
    if (!process.env[key]) problems.push(`${key} chưa được đặt`);
  }

  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = process.env[key];
    if (value && value.length < MIN_SECRET_LENGTH) {
      problems.push(
        `${key} chỉ dài ${value.length} ký tự, cần tối thiểu ${MIN_SECRET_LENGTH}`
      );
    }
  }

  // Same secret for both means a refresh token verifies as an access token — the whole
  // point of short-lived access tokens disappears.
  if (
    process.env.JWT_ACCESS_SECRET &&
    process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET
  ) {
    problems.push('JWT_ACCESS_SECRET và JWT_REFRESH_SECRET đang giống nhau, phải khác nhau');
  }

  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('mysql://')) {
    problems.push('DATABASE_URL phải bắt đầu bằng mysql://');
  }

  if (problems.length === 0) return;

  // Every problem at once: fixing one per restart is a slow way to configure a project.
  console.error('\nKhông khởi động được — cấu hình .env chưa hợp lệ:\n');
  problems.forEach((problem) => console.error(`  - ${problem}`));
  console.error('\nXem .env.example để biết cần những gì. Sinh secret mới:');
  console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n');
  process.exit(1);
}

module.exports = { validateEnv };