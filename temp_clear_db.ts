import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting to clear old provider configurations...');

  // Delete items first due to database constraints
  const deletedItems = await prisma.providerItem.deleteMany({});
  console.log(`- Deleted ${deletedItems.count} provider item records.`);

  // Then delete the providers
  const deletedProviders = await prisma.provider.deleteMany({});
  console.log(`- Deleted ${deletedProviders.count} provider records.`);

  console.log('✅ Old configurations cleared successfully.');
}

main()
  .catch((e) => {
    console.error('An error occurred while clearing the database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
