import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@atulyapanel.com' },
    update: {},
    create: {
      email: 'admin@atulyapanel.com',
      username: 'admin',
      password: adminPassword,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  console.log('✅ Admin user created:', adminUser.email);

  // Create test user
  const userPassword = await bcrypt.hash('user123', 12);
  const testUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      username: 'testuser',
      password: userPassword,
      role: UserRole.USER,
      isActive: true,
    },
  });

  console.log('✅ Test user created:', testUser.email);

  // Create sample site
  const sampleSite = await prisma.site.upsert({
    where: { domain: 'example.com' },
    update: {},
    create: {
      domain: 'example.com',
      documentRoot: 'public_html',
      phpVersion: '8.2',
      sslEnabled: false,
      isActive: true,
      userId: testUser.id,
    },
  });

  console.log('✅ Sample site created:', sampleSite.domain);

  // Create sample database
  const sampleDatabase = await prisma.database.upsert({
    where: { name: 'sample_db' },
    update: {},
    create: {
      name: 'sample_db',
      username: 'sample_user',
      password: 'sample_password',
      size: 1024 * 1024, // 1MB
      isActive: true,
      userId: testUser.id,
      siteId: sampleSite.id,
    },
  });

  console.log('✅ Sample database created:', sampleDatabase.name);

  // Create sample email account
  const sampleEmail = await prisma.emailAccount.upsert({
    where: { address: 'test@example.com' },
    update: {},
    create: {
      address: 'test@example.com',
      password: 'email_password',
      quota: 1073741824, // 1GB
      used: 0,
      isActive: true,
      userId: testUser.id,
      siteId: sampleSite.id,
    },
  });

  console.log('✅ Sample email account created:', sampleEmail.address);

  // Create sample domain
  const sampleDomain = await prisma.domain.upsert({
    where: { name: 'www.example.com' },
    update: {},
    create: {
      name: 'www.example.com',
      type: 'SUBDOMAIN',
      sslStatus: 'not_issued',
      isActive: true,
      siteId: sampleSite.id,
    },
  });

  console.log('✅ Sample domain created:', sampleDomain.name);

  // Create system configuration
  const configs = [
    { key: 'panel_name', value: 'Atulya Panel' },
    { key: 'panel_version', value: '2.0.0' },
    { key: 'max_sites_per_user', value: '10' },
    { key: 'max_databases_per_user', value: '20' },
    { key: 'max_email_accounts_per_user', value: '50' },
    { key: 'default_php_version', value: '8.2' },
    { key: 'backup_retention_days', value: '30' },
    { key: 'ssl_auto_renewal', value: 'true' },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    });
  }

  console.log('✅ System configuration created');

  console.log('🎉 Database seed completed successfully!');
  console.log('');
  console.log('📋 Default credentials:');
  console.log('Admin: admin@atulyapanel.com / admin123');
  console.log('User:  user@example.com / user123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
