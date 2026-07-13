const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');

async function main() {
  const password_hash = await bcrypt.hash('password', 10);

  await prisma.users.upsert({
    where: { email: 'admin@admin.com' },
    update: {},
    create: {
      full_name: 'Admin',
      email: 'admin@admin.com',
      password_hash,
      role: 'admin',
    },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
