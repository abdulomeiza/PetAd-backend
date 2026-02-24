// /* eslint-disable @typescript-eslint/no-unused-vars */
// import 'dotenv/config';
// import { PrismaPg } from '@prisma/adapter-pg';
// // import { PrismaClient } from '../generated/prisma/client';
// import { PrismaClient } from '@prisma/client';
// const adapter = new PrismaPg({
//   connectionString: process.env.DATABASE_URL as string,
// });
// const prisma = new PrismaClient({ adapter });

// async function main() {
//   console.log('🌱 Seeding database...');

//   // Clean existing data in reverse dependency order
//   await prisma.eventLog.deleteMany();
//   await prisma.adoption.deleteMany();
//   await prisma.custody.deleteMany();
//   await prisma.escrow.deleteMany();
//   await prisma.pet.deleteMany();
//   await prisma.user.deleteMany();

//   // ─── Users ───────────────────────────────────────────────

//   const admin = await prisma.user.create({
//     data: {
//       email: 'admin@petad.org',
//       password: '$2b$10$placeholder_hash_admin',
//       firstName: 'Platform',
//       lastName: 'Admin',
//       role: 'ADMIN',
//     },
//   });

//   const shelter = await prisma.user.create({
//     data: {
//       email: 'happypaws@shelter.org',
//       password: '$2b$10$placeholder_hash_shelter',
//       firstName: 'Happy Paws',
//       lastName: 'Shelter',
//       role: 'SHELTER',
//       stellarPublicKey:
//         'GBHAPPY0PAWS0SHELTER0STELLAR0PUBLIC0KEY000000000000000',
//     },
//   });

//   const adopter = await prisma.user.create({
//     data: {
//       email: 'jane@example.com',
//       password: '$2b$10$placeholder_hash_user',
//       firstName: 'Jane',
//       lastName: 'Doe',
//       role: 'USER',
//       stellarPublicKey:
//         'GJANED0E0USER0STELLAR0PUBLIC0KEY00000000000000000000000',
//     },
//   });

//   const keeper = await prisma.user.create({
//     data: {
//       email: 'bob@example.com',
//       password: '$2b$10$placeholder_hash_keeper',
//       firstName: 'Bob',
//       lastName: 'Smith',
//       role: 'USER',
//     },
//   });

//   console.log(`  ✓ Created ${4} users`);

//   // ─── Pets ────────────────────────────────────────────────

//   const buddy = await prisma.pet.create({
//     data: {
//       name: 'Buddy',
//       species: 'DOG',
//       breed: 'Golden Retriever',
//       age: 3,
//       description:
//         'Friendly and energetic golden retriever who loves playing fetch.',
//     currentOwnerId: shelter.id
//     },
//   });

//   const whiskers = await prisma.pet.create({
//     data: {
//       name: 'Whiskers',
//       species: 'CAT',
//       breed: 'Siamese',
//       age: 2,
//       description: 'Calm and affectionate indoor cat. Great with children.',
//       currentOwnerId: shelter.id
//   });

//   const tweety = await prisma.pet.create({
//     data: {
//       name: 'Tweety',
//       species: 'BIRD',
//       breed: 'Canary',
//       age: 1,
//       description: 'Beautiful singing canary with bright yellow feathers.',
//       currentOwnerId: shelter.id
//     },
//   });

//   const max = await prisma.pet.create({
//     data: {
//       name: 'Max',
//       species: 'DOG',
//       breed: 'German Shepherd',
//       age: 4,
//       description: 'Well-trained and loyal. Needs a home with a yard.',
//      currentOwnerId: shelter.id
//     },
//   });

//   console.log(`  ✓ Created ${4} pets`);

//   // ─── Adoption Requests ───────────────────────────────────

//   const adoption = await prisma.adoption.create({
//     data: {
//       status: 'PENDING',
//       notes: 'I have a large backyard and experience with shepherds.',
//       petId: max.id,
//       adopterId: adopter.id,
//      currentOwnerId: shelter.id
//     },
//   });

//   console.log(`  ✓ Created 1 adoption request`);

//   // ─── Custody Agreements ──────────────────────────────────

//   const now = new Date();
//   const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

//   await prisma.custody.create({
//     data: {
//       status: 'ACTIVE',
//       depositAmount: 150.0,
//       startDate: now,
//       endDate: twoWeeksLater,
//       terms: 'Daily walks, regular feeding schedule, no off-leash in public.',
//       petId: buddy.id,
//       ownerId: shelter.id,
//       keeperId: keeper.id,
//     },
//   });

//   console.log(`  ✓ Created 1 custody agreement`);

//   // ─── Event Logs ──────────────────────────────────────────

//   await prisma.eventLog.createMany({
//     data: [
//       {
//         type: 'USER_REGISTERED',
//         aggregateId: adopter.id,
//         payload: { email: adopter.email },
//       },
//       {
//         type: 'PET_LISTED',
//         aggregateId: buddy.id,
//         payload: { name: buddy.name, species: buddy.species },
//       },
//       {
//         type: 'PET_LISTED',
//         aggregateId: whiskers.id,
//         payload: { name: whiskers.name, species: whiskers.species },
//       },
//       {
//         type: 'ADOPTION_REQUESTED',
//         aggregateId: adoption.id,
//         payload: { petId: max.id, adopterId: adopter.id },
//       },
//     ],
//   });

//   console.log(`  ✓ Created 4 event logs`);

//   console.log('✅ Seeding complete!');
// }

// main()
//   .catch((error) => {
//     console.error('❌ Seeding failed:', error);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });


/* eslint-disable @typescript-eslint/no-unused-vars */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // Clean in dependency-safe order
  await prisma.eventLog.deleteMany();
  await prisma.adoption.deleteMany();
  await prisma.custody.deleteMany();
  await prisma.escrow.deleteMany();
  await prisma.pet.deleteMany();
  await prisma.user.deleteMany();

  // ─────────────────────────────────────────
  // USERS
  // ─────────────────────────────────────────

  const admin = await prisma.user.create({
    data: {
      email: 'admin@petad.org',
      password: 'hashed_admin_password',
      firstName: 'Platform',
      lastName: 'Admin',
      role: 'ADMIN',
      trustScore: 100,
    },
  });

  const shelter = await prisma.user.create({
    data: {
      email: 'shelter@petad.org',
      password: 'hashed_shelter_password',
      firstName: 'Happy',
      lastName: 'Shelter',
      role: 'SHELTER',
      stellarPublicKey: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1',
    },
  });

  const adopter = await prisma.user.create({
    data: {
      email: 'jane@petad.org',
      password: 'hashed_user_password',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'USER',
      stellarPublicKey: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX2',
    },
  });

  const temporaryHolder = await prisma.user.create({
    data: {
      email: 'bob@petad.org',
      password: 'hashed_holder_password',
      firstName: 'Bob',
      lastName: 'Smith',
      role: 'USER',
    },
  });

  console.log('✓ Users created');

  // ─────────────────────────────────────────
  // PETS
  // ─────────────────────────────────────────

  const buddy = await prisma.pet.create({
    data: {
      name: 'Buddy',
      species: 'DOG',
      breed: 'Golden Retriever',
      age: 3,
      description: 'Friendly and energetic dog.',
      currentOwnerId: shelter.id,
    },
  });

  const max = await prisma.pet.create({
    data: {
      name: 'Max',
      species: 'DOG',
      breed: 'German Shepherd',
      age: 4,
      description: 'Well trained and loyal.',
      currentOwnerId: shelter.id,
    },
  });

  console.log('✓ Pets created');

  // ─────────────────────────────────────────
  // ESCROW FOR ADOPTION
  // ─────────────────────────────────────────

  const adoptionEscrow = await prisma.escrow.create({
    data: {
      stellarPublicKey: 'GESCROWXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1',
      stellarSecretEncrypted: 'encrypted_secret_here',
      amount: 250.0,
      assetCode: 'XLM',
      status: 'FUNDED',
      fundingTxHash: 'stellar_funding_tx_hash_example',
      requiredSignatures: 2,
    },
  });

  // ─────────────────────────────────────────
  // ADOPTION
  // ─────────────────────────────────────────

  const adoption = await prisma.adoption.create({
    data: {
      status: 'ESCROW_FUNDED',
      notes: 'Adopter has a secure home and experience.',
      petId: max.id,
      adopterId: adopter.id,
      ownerId: shelter.id,
      escrowId: adoptionEscrow.id,
    },
  });

  console.log('✓ Adoption with escrow created');

  // ─────────────────────────────────────────
  // ESCROW FOR CUSTODY
  // ─────────────────────────────────────────

  const custodyEscrow = await prisma.escrow.create({
    data: {
      stellarPublicKey: 'GESCROWXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX2',
      stellarSecretEncrypted: 'encrypted_secret_here_2',
      amount: 150.0,
      assetCode: 'XLM',
      status: 'CREATED',
      requiredSignatures: 2,
    },
  });

  // ─────────────────────────────────────────
  // CUSTODY
  // ─────────────────────────────────────────

  const now = new Date();
  const twoWeeksLater = new Date(
    now.getTime() + 14 * 24 * 60 * 60 * 1000
  );

  const custody = await prisma.custody.create({
    data: {
      status: 'ACTIVE',
      type: 'TEMPORARY',
      depositAmount: 150.0,
      startDate: now,
      endDate: twoWeeksLater,
      petId: buddy.id,
      holderId: temporaryHolder.id,
      escrowId: custodyEscrow.id,
    },
  });

  console.log('✓ Custody with escrow created');

  // ─────────────────────────────────────────
  // EVENT LOGS
  // ─────────────────────────────────────────

  await prisma.eventLog.createMany({
    data: [
      {
        entityType: 'USER',
        entityId: adopter.id,
        eventType: 'USER_REGISTERED',
        actorId: adopter.id,
        payload: { email: adopter.email },
      },
      {
        entityType: 'PET',
        entityId: buddy.id,
        eventType: 'PET_REGISTERED',
        actorId: shelter.id,
        payload: { name: buddy.name },
      },
      {
        entityType: 'ESCROW',
        entityId: adoptionEscrow.id,
        eventType: 'ESCROW_CREATED',
        actorId: adopter.id,
        payload: { amount: 250.0 },
      },
      {
        entityType: 'ADOPTION',
        entityId: adoption.id,
        eventType: 'ADOPTION_APPROVED',
        actorId: shelter.id,
        payload: { petId: max.id },
      },
      {
        entityType: 'CUSTODY',
        entityId: custody.id,
        eventType: 'CUSTODY_STARTED',
        actorId: temporaryHolder.id,
        payload: { petId: buddy.id },
      },
    ],
  });

  console.log('✓ Event logs created');

  console.log('✅ Seeding complete!');
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });