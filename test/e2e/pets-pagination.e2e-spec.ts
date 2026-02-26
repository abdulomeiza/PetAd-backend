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
   @typescript-eslint/no-unsafe-argument,
   @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-unused-vars */

describe('Pet Pagination (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let userId: string;

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

    const hashedAdminPassword = await bcrypt.hash('Admin@123', 10);
    const adminUser = await prismaService.user.create({
      data: {
        email: 'admin@pagination-test.com',
        password: hashedAdminPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
      },
    });

    userId = adminUser.id;

    for (let i = 1; i <= 45; i++) {
      await prismaService.pet.create({
        data: {
          name: `Pet ${i}`,
          species: i % 3 === 0 ? PetSpecies.CAT : PetSpecies.DOG,
          breed: i % 2 === 0 ? 'Golden Retriever' : 'Labrador',
          age: (i % 10) + 1,
          description: `Test pet number ${i}`,
          imageUrl: `https://example.com/pet${i}.jpg`,
          status: PetStatus.AVAILABLE,
          currentOwnerId: userId,
        },
      });
    }
  }, 30000);

  afterAll(async () => {
    await app.close();
  }, 30000);

  describe('Basic Pagination', () => {
    it('should return first 20 pets by default', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets')
        .expect(200);

      expect(res.body.data).toHaveLength(20);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(20);
      expect(res.body.meta.total).toBe(45);
      expect(res.body.meta.totalPages).toBe(3);
      expect(res.body.meta.hasNextPage).toBe(true);
      expect(res.body.meta.hasPreviousPage).toBe(false);
    });

    it('should return page 2 with limit 10', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?page=2&limit=10')
        .expect(200);

      expect(res.body.data).toHaveLength(10);
      expect(res.body.meta.page).toBe(2);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.hasNextPage).toBe(true);
      expect(res.body.meta.hasPreviousPage).toBe(true);
    });

    it('should return last page correctly', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?page=5&limit=10')
        .expect(200);

      expect(res.body.data).toHaveLength(5);
      expect(res.body.meta.page).toBe(5);
      expect(res.body.meta.hasNextPage).toBe(false);
      expect(res.body.meta.hasPreviousPage).toBe(true);
    });

    it('should handle custom limit', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?limit=5')
        .expect(200);

      expect(res.body.data).toHaveLength(5);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.meta.totalPages).toBe(9);
    });
  });

  describe('Metadata Accuracy', () => {
    it('should calculate totalPages correctly', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?limit=10')
        .expect(200);

      expect(res.body.meta.totalPages).toBe(5);
    });

    it('should set hasNextPage correctly on middle page', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?page=2&limit=10')
        .expect(200);

      expect(res.body.meta.hasNextPage).toBe(true);
      expect(res.body.meta.hasPreviousPage).toBe(true);
    });

    it('should set hasPreviousPage correctly on first page', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?page=1&limit=20')
        .expect(200);

      expect(res.body.meta.hasPreviousPage).toBe(false);
      expect(res.body.meta.hasNextPage).toBe(true);
    });
  });

  describe('Filtering + Pagination', () => {
    it('should paginate filtered results by species', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?species=DOG&limit=5')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((pet: any) => pet.species === 'DOG')).toBe(
        true,
      );
    });

    it('should paginate search results', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?search=pet&limit=10')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should combine species filter with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?species=CAT&page=1&limit=5')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((pet: any) => pet.species === 'CAT')).toBe(
        true,
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle page beyond total', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?page=999&limit=20')
        .expect(200);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(45);
      expect(res.body.meta.hasNextPage).toBe(false);
    });

    it('should handle limit larger than total', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?limit=100')
        .expect(200);

      expect(res.body.data).toHaveLength(45);
      expect(res.body.meta.totalPages).toBe(1);
      expect(res.body.meta.hasNextPage).toBe(false);
    });

    it('should maintain order across pages', async () => {
      const page1 = await request(app.getHttpServer())
        .get('/pets?page=1&limit=10')
        .expect(200);

      const page2 = await request(app.getHttpServer())
        .get('/pets?page=2&limit=10')
        .expect(200);

      expect(page1.body.data.length).toBeGreaterThan(0);
      expect(page2.body.data.length).toBeGreaterThan(0);

      const page1Ids = page1.body.data.map((pet: any) => pet.id);
      const page2Ids = page2.body.data.map((pet: any) => pet.id);
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('Response Structure', () => {
    it('should return pets with all required fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?limit=1')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      const pet = res.body.data[0];

      expect(pet).toHaveProperty('id');
      expect(pet).toHaveProperty('name');
      expect(pet).toHaveProperty('species');
      expect(pet).toHaveProperty('status');
    });

    it('should return correct metadata structure', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('page');
      expect(res.body.meta).toHaveProperty('limit');
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('totalPages');
      expect(res.body.meta).toHaveProperty('hasNextPage');
      expect(res.body.meta).toHaveProperty('hasPreviousPage');
    });
  });

  describe('Validation', () => {
    it('should reject page less than 1', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?page=0')
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should reject limit greater than 100', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?limit=101')
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should reject non-integer page', async () => {
      const res = await request(app.getHttpServer())
        .get('/pets?page=abc')
        .expect(400);

      expect(res.body.message).toBeDefined();
    });
  });
});

