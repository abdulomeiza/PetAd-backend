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

describe.skip('Pet Ownership Validation (E2E)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let shelterAToken: string;
  let shelterBToken: string;
  let adminToken: string;
  let shelterAId: string;
  let shelterBId: string;
  let petId: string;

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
    const shelterA = await prismaService.user.create({
      data: {
        email: 'sheltera@ownership-test.com',
        password: hashedPassword,
        firstName: 'Shelter',
        lastName: 'A',
        role: UserRole.SHELTER,
      },
    });
    shelterAId = shelterA.id;

    const shelterB = await prismaService.user.create({
      data: {
        email: 'shelterb@ownership-test.com',
        password: hashedPassword,
        firstName: 'Shelter',
        lastName: 'B',
        role: UserRole.SHELTER,
      },
    });
    shelterBId = shelterB.id;

    await prismaService.user.create({
      data: {
        email: 'admin@ownership-test.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
      },
    });

    const shelterALogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'sheltera@ownership-test.com',
        password: 'Test@123',
      });
    shelterAToken = shelterALogin.body.access_token;

    const shelterBLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'shelterb@ownership-test.com',
        password: 'Test@123',
      });
    shelterBToken = shelterBLogin.body.access_token;

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@ownership-test.com',
        password: 'Test@123',
      });
    adminToken = adminLogin.body.access_token;

    const pet = await prismaService.pet.create({
      data: {
        name: 'Buddy',
        species: PetSpecies.DOG,
        breed: 'Golden Retriever',
        age: 3,
        description: 'Test dog',
        status: PetStatus.AVAILABLE,
        currentOwnerId: shelterAId,
      },
    });
    petId = pet.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  }, 30000);

  describe('Owner Updates Own Pet', () => {
    it('should allow owner to update their pet', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/pets/${petId}`)
        .set('Authorization', `Bearer ${shelterAToken}`)
        .send({
          name: 'Updated Buddy',
          description: 'Updated description',
        })
        .expect(200);

      expect(res.body.name).toBe('Updated Buddy');
      expect(res.body.description).toBe('Updated description');
      expect(res.body.currentOwnerId).toBe(shelterAId);
    });

    it('should allow owner to update multiple times', async () => {
      await request(app.getHttpServer())
        .patch(`/pets/${petId}`)
        .set('Authorization', `Bearer ${shelterAToken}`)
        .send({ name: 'Buddy v2' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/pets/${petId}`)
        .set('Authorization', `Bearer ${shelterAToken}`)
        .send({ name: 'Buddy v3' })
        .expect(200);

      expect(res.body.name).toBe('Buddy v3');
    });
  });

  describe('Non-Owner Blocked', () => {
    it('should block non-owner from updating pet', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/pets/${petId}`)
        .set('Authorization', `Bearer ${shelterBToken}`)
        .send({
          name: 'Hacked Name',
        })
        .expect(403);

      expect(res.body.message).toBe('You can only update your own pets');
      expect(res.body.statusCode).toBe(403);
    });

    it('should not modify pet when non-owner attempts update', async () => {
      // Get current pet name
      const before = await prismaService.pet.findUnique({
        where: { id: petId },
      });
      const originalName = before?.name;

      // Attempt unauthorized update
      await request(app.getHttpServer())
        .patch(`/pets/${petId}`)
        .set('Authorization', `Bearer ${shelterBToken}`)
        .send({ name: 'Hacked' })
        .expect(403);

      // Verify pet was not modified
      const after = await prismaService.pet.findUnique({
        where: { id: petId },
      });
      expect(after?.name).toBe(originalName);
    });
  });

  describe('Admin Override', () => {
    it('should allow admin to update any pet', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/pets/${petId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Updated',
          description: 'Updated by admin',
        })
        .expect(200);

      expect(res.body.name).toBe('Admin Updated');
      expect(res.body.description).toBe('Updated by admin');
    });

    it('should allow admin to update pet owned by different user', async () => {
      // Verify pet is owned by Shelter A
      const pet = await prismaService.pet.findUnique({ where: { id: petId } });
      expect(pet?.currentOwnerId).toBe(shelterAId);

      // Admin can still update
      const res = await request(app.getHttpServer())
        .patch(`/pets/${petId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Admin Override' })
        .expect(200);

      expect(res.body.name).toBe('Admin Override');
    });
  });

  describe('404 Before 403', () => {
    it('should return 404 for non-existent pet (not 403)', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(app.getHttpServer())
        .patch(`/pets/${fakeId}`)
        .set('Authorization', `Bearer ${shelterBToken}`)
        .send({ name: 'Test' })
        .expect(404);

      expect(res.body.message).toBe('Pet not found');
      expect(res.body.statusCode).toBe(404);
    });

    it('should return 404 even for owner with non-existent pet', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(app.getHttpServer())
        .patch(`/pets/${fakeId}`)
        .set('Authorization', `Bearer ${shelterAToken}`)
        .send({ name: 'Test' })
        .expect(404);

      expect(res.body.message).toBe('Pet not found');
    });
  });

  describe('Delete Operations', () => {
    let petToDelete: string;

    beforeEach(async () => {
      // Create a pet to delete
      const pet = await prismaService.pet.create({
        data: {
          name: 'Pet to Delete',
          species: PetSpecies.CAT,
          status: PetStatus.AVAILABLE,
          currentOwnerId: shelterAId,
        },
      });
      petToDelete = pet.id;
    });

    it('should allow admin to delete pet', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/pets/${petToDelete}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.message).toBe('Pet deleted successfully');

      // Verify pet is deleted
      const deleted = await prismaService.pet.findUnique({
        where: { id: petToDelete },
      });
      expect(deleted).toBeNull();
    });

    it('should block shelter owner from deleting their own pet', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/pets/${petToDelete}`)
        .set('Authorization', `Bearer ${shelterAToken}`)
        .expect(403);

      expect(res.body.message).toContain('Forbidden');

      const pet = await prismaService.pet.findUnique({
        where: { id: petToDelete },
      });
      expect(pet).not.toBeNull();
    });

    it('should block non-owner shelter from deleting pet', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/pets/${petToDelete}`)
        .set('Authorization', `Bearer ${shelterBToken}`)
        .expect(403);

      expect(res.body.message).toContain('Forbidden');
    });

    it('should return 404 when deleting non-existent pet', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(app.getHttpServer())
        .delete(`/pets/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.message).toBe('Pet not found');
    });
  });

  describe('Authentication Required', () => {
    it('should require authentication for update', async () => {
      await request(app.getHttpServer())
        .patch(`/pets/${petId}`)
        .send({ name: 'No Auth' })
        .expect(401);
    });

    it('should require authentication for delete', async () => {
      await request(app.getHttpServer())
        .delete(`/pets/${petId}`)
        .expect(401);
    });

    it('should reject invalid JWT token', async () => {
      await request(app.getHttpServer())
        .patch(`/pets/${petId}`)
        .set('Authorization', 'Bearer invalid-token')
        .send({ name: 'Test' })
        .expect(401);
    });
  });

  describe('Role Guard', () => {
    let userToken: string;

    beforeAll(async () => {
      // Create regular USER
      const hashedPassword = await bcrypt.hash('Test@123', 10);
      await prismaService.user.create({
        data: {
          email: 'user@ownership-test.com',
          password: hashedPassword,
          firstName: 'Regular',
          lastName: 'User',
          role: UserRole.USER,
        },
      });

      // Login as USER
      const userLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'user@ownership-test.com',
          password: 'Test@123',
        });
      userToken = userLogin.body.access_token;
    });

    it('should block regular USER from updating pets', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/pets/${petId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'User Update' })
        .expect(403);

      expect(res.body.message).toContain('Forbidden');
    });

    it('should block regular USER from deleting pets', async () => {
      await request(app.getHttpServer())
        .delete(`/pets/${petId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('Multiple Pet Ownership', () => {
    let shelterAPet1: string;
    let shelterAPet2: string;
    let shelterBPet1: string;

    beforeAll(async () => {
      // Create multiple pets for Shelter A
      const petA1 = await prismaService.pet.create({
        data: {
          name: 'Shelter A Pet 1',
          species: PetSpecies.DOG,
          status: PetStatus.AVAILABLE,
          currentOwnerId: shelterAId,
        },
      });
      shelterAPet1 = petA1.id;

      const petA2 = await prismaService.pet.create({
        data: {
          name: 'Shelter A Pet 2',
          species: PetSpecies.CAT,
          status: PetStatus.AVAILABLE,
          currentOwnerId: shelterAId,
        },
      });
      shelterAPet2 = petA2.id;

      // Create pet for Shelter B
      const petB1 = await prismaService.pet.create({
        data: {
          name: 'Shelter B Pet 1',
          species: PetSpecies.RABBIT,
          status: PetStatus.AVAILABLE,
          currentOwnerId: shelterBId,
        },
      });
      shelterBPet1 = petB1.id;
    });

    it('should allow Shelter A to update all their pets', async () => {
      await request(app.getHttpServer())
        .patch(`/pets/${shelterAPet1}`)
        .set('Authorization', `Bearer ${shelterAToken}`)
        .send({ name: 'Updated A1' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/pets/${shelterAPet2}`)
        .set('Authorization', `Bearer ${shelterAToken}`)
        .send({ name: 'Updated A2' })
        .expect(200);
    });

    it('should block Shelter A from updating Shelter B pets', async () => {
      await request(app.getHttpServer())
        .patch(`/pets/${shelterBPet1}`)
        .set('Authorization', `Bearer ${shelterAToken}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });

    it('should block Shelter B from updating Shelter A pets', async () => {
      await request(app.getHttpServer())
        .patch(`/pets/${shelterAPet1}`)
        .set('Authorization', `Bearer ${shelterBToken}`)
        .send({ name: 'Hacked' })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/pets/${shelterAPet2}`)
        .set('Authorization', `Bearer ${shelterBToken}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });

    it('should allow admin to update any shelter pets', async () => {
      await request(app.getHttpServer())
        .patch(`/pets/${shelterAPet1}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Admin Update A1' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/pets/${shelterBPet1}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Admin Update B1' })
        .expect(200);
    });
  });
});

