import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Seeded in this exact order.
const COMMUNITIES = [
  "San Marcos",
  "Buda",
  "Kyle",
  "Lockhart",
  "Luling",
  "Wimberley",
  "Dripping Springs",
  "Mustang Ridge",
  "Uhland",
];

async function main() {
  for (let i = 0; i < COMMUNITIES.length; i++) {
    const name = COMMUNITIES[i];
    await prisma.community.upsert({
      where: { name },
      update: { order: i },
      create: { name, order: i },
    });
  }
  console.log(`Seeded ${COMMUNITIES.length} communities.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
