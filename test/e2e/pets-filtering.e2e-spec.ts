import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PetStatus, UserRole, PetSpecies } from '../../src/common/enums';

/* eslint-disable @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-argument */

describe.skip('Pet Search & Filtering (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let shelterToken: string;
  let shelterId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    await prismaService.pet.deleteMany({});
    await prismaService.user.deleteMany({});

    const hashedPassword = await bcrypt.hash('Test@123', 10);
    const shelter = await prismaService.user.create({
      data: {
        email: 'shelter@filtering-test.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'Shelter',
        role: UserRole.SHELTER,
      },
    });

    shelterId = shelter.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'shelter@filtering-test.com',
        password: 'Test@123',
      });

    shelterToken = loginResponse.body.access_token;

    const pets = [
      {
        name: 'Buddy',
        species: PetSpecies.DOG,
        breed: 'Golden Retriever',
        age: 3,
        description: 'Friendly dog in Lagos',
        status: PetStatus.AVAILABLE,
        currentOwnerId: shelterId,
      },
      {
        name: 'Max',
        species: PetSpecies.DOG,
        breed: 'Labrador',
        age: 2,
        description: 'Playful puppy',
        status: PetStatus.AVAILABLE,
        currentOwnerId: shelterId,
      },
      {
        name: 'Whiskers',
        species: PetSpecies.CAT,
        breed: 'Siamese',
        age: 5,
        description: 'Calm cat in Lagos',
        status: PetStatus.AVAILABLE,
        currentOwnerId: shelterId,
      },
      {
        name: 'Luna',
        species: PetSpecies.CAT,
        breed: 'Persian',
        age: 1,
        description: 'Young kitten',
        status: PetStatus.AVAILABLE,
        currentOwnerId: shelterId,
      },
      {
        name: 'Rocky',
        species: PetSpecies.DOG,
        breed: 'German Shepherd',
        age: 6,
        description: 'Guard dog',
        status: PetStatus.PENDING,
        currentOwnerId: shelterId,
      },
      {
        name: 'Fluffy',
        species: PetSpecies.RABBIT,
        breed: 'Angora',
        age: 2,
        description: 'Soft rabbit',
        status: PetStatus.AVAILABLE,
        currentOwnerId: shelterId,
      },
    ];

    await prismaService.pet.createMany({ data: pets });
  }, 30000);

  afterAll(async () => {
    await app.close();
  }, 30000);

  describe('Filter by Species', () => {
    it('should filter by species=DOG', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?species=DOG')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((pet: any) => pet.species === 'DOG')).toBe(
        true,
      );
    });

    it('should filter by species=CAT', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?species=CAT')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((pet: any) => pet.species === 'CAT')).toBe(
        true,
      );
    });

    it('should filter by species=RABBIT', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?species=RABBIT')
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Fluffy');
    });
  });

  describe('Filter by Breed', () => {
    it('should filter by breed (case-insensitive)', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?breed=retriever')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(
        res.body.data.some((pet: any) => pet.breed?.includes('Retriever')),
      ).toBe(true);
    });

    it('should filter by breed=Labrador', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?breed=Labrador')
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Max');
    });
  });

  describe('Filter by Location', () => {
    it('should filter by location (searches description)', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?location=Lagos')
        .expect(200);

      expect(res.body.data.length).toBe(2); // Buddy and Whiskers
      expect(
        res.body.data.every(
          (pet: any) =>
            pet.description?.includes('Lagos') ||
            pet.description?.includes('lagos'),
        ),
      ).toBe(true);
    });
  });

  describe('Filter by Age Range', () => {
    it('should filter by minAge', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?minAge=3')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((pet: any) => pet.age >= 3)).toBe(true);
    });

    it('should filter by maxAge', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?maxAge=2')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((pet: any) => pet.age <= 2)).toBe(true);
    });

    it('should filter by age range (minAge and maxAge)', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?minAge=2&maxAge=5')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(
        res.body.data.every((pet: any) => pet.age >= 2 && pet.age <= 5),
      ).toBe(true);
    });
  });

  describe('Keyword Search', () => {
    it('should search in name', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?search=Buddy')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].name).toBe('Buddy');
    });

    it('should search in breed', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?search=Golden')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.some((pet: any) => pet.breed?.includes('Golden')))
        .toBe(true);
    });

    it('should search in description', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?search=Friendly')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(
        res.body.data.some((pet: any) =>
          pet.description?.includes('Friendly'),
        ),
      ).toBe(true);
    });

    it('should search case-insensitively', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?search=FRIENDLY')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Multiple Filters Combined', () => {
    it('should combine species and age filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?species=DOG&minAge=2&maxAge=4')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(
        res.body.data.every(
          (pet: any) =>
            pet.species === 'DOG' && pet.age >= 2 && pet.age <= 4,
        ),
      ).toBe(true);
    });

    it('should combine species, breed, and age filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?species=DOG&breed=retriever&maxAge=5')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(
        res.body.data.every(
          (pet: any) =>
            pet.species === 'DOG' &&
            pet.breed?.toLowerCase().includes('retriever') &&
            pet.age <= 5,
        ),
      ).toBe(true);
    });

    it('should combine search with filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?species=DOG&search=playful')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(
        res.body.data.every(
          (pet: any) =>
            pet.species === 'DOG' &&
            (pet.name?.toLowerCase().includes('playful') ||
              pet.description?.toLowerCase().includes('playful')),
        ),
      ).toBe(true);
    });
  });

  describe('Filter by Status', () => {
    it('should default to AVAILABLE status', async () => {
      const res = await request(app.getHttpServer()).get('/pets').expect(200);

      expect(res.body.data.every((pet: any) => pet.status === 'AVAILABLE'))
        .toBe(true);
    });

    it('should filter by status=PENDING', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?status=PENDING')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((pet: any) => pet.status === 'PENDING')).toBe(
        true,
      );
    });
  });

  describe('Pagination with Filters', () => {
    it('should paginate filtered results', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?species=DOG&page=1&limit=2')
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.data.every((pet: any) => pet.species === 'DOG')).toBe(
        true,
      );
    });

    it('should return correct metadata with filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?species=CAT')
        .expect(200);

      expect(res.body.meta).toHaveProperty('page');
      expect(res.body.meta).toHaveProperty('limit');
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('totalPages');
      expect(res.body.meta).toHaveProperty('hasNextPage');
      expect(res.body.meta).toHaveProperty('hasPreviousPage');
    });
  });

  describe('Edge Cases', () => {
    it('should return empty array when no matches', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?species=BIRD')
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
      expect(res.body.meta.totalPages).toBe(0);
    });

    it('should return empty array for impossible age range', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?minAge=100&maxAge=200')
        .expect(200);

      expect(res.body.data).toEqual([]);
    });

    it('should handle no filters (return all available)', async () => {
      const res = await request(app.getHttpServer()).get('/pets').expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((pet: any) => pet.status === 'AVAILABLE'))
        .toBe(true);
    });
  });

  describe('Validation', () => {
    it('should reject invalid species', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?species=INVALID')
        .expect(400);

      expect(res.body.message).toContain('Invalid species value');
    });

    it('should reject negative minAge', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?minAge=-1')
        .expect(400);

      expect(res.body.message).toContain('Minimum age cannot be negative');
    });

    it('should reject non-integer page', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?page=abc')
        .expect(400);

      expect(res.body.message).toContain('Page must be an integer');
    });
  });
});

