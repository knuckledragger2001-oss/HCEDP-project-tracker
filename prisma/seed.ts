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

// Known electric utility providers in the region. New ones (electric or water)
// can be added through the app; these are the defaults.
const ELECTRIC_PROVIDERS = ["Bluebonnet Electric Co-Op", "Pedernales Electric Co-Op"];

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

  for (let i = 0; i < ELECTRIC_PROVIDERS.length; i++) {
    const name = ELECTRIC_PROVIDERS[i];
    await prisma.utilityProvider.upsert({
      where: { type_name: { type: "ELECTRIC", name } },
      update: { order: i },
      create: { name, type: "ELECTRIC", order: i },
    });
  }
  console.log(`Seeded ${ELECTRIC_PROVIDERS.length} electric providers.`);
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
