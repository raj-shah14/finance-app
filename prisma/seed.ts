import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEFAULT_CATEGORIES, PLAID_CATEGORY_MAP } from "../src/lib/categories";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding categories...");

  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { emoji: cat.emoji, color: cat.color, sortOrder: cat.sortOrder },
      create: {
        name: cat.name,
        emoji: cat.emoji,
        color: cat.color,
        sortOrder: cat.sortOrder,
        isDefault: true,
      },
    });
  }

  console.log(`✅ ${DEFAULT_CATEGORIES.length} categories seeded`);

  // Seed Plaid category mappings
  const categories = await prisma.category.findMany();
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  for (const [plaidCat, ourCatName] of Object.entries(PLAID_CATEGORY_MAP)) {
    const categoryId = catByName[ourCatName];
    if (!categoryId) continue;

    await prisma.categoryMapping.upsert({
      where: { plaidDetailed: plaidCat },
      update: { categoryId },
      create: { plaidDetailed: plaidCat, categoryId },
    });
  }

  console.log(`✅ ${Object.keys(PLAID_CATEGORY_MAP).length} Plaid category mappings seeded`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
