import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Protected Route (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject access to protected route without JWT', async () => {
    const res = await request(app.getHttpServer()).get('/protected');
    expect(res.status).toBe(401);
    expect((res.body as { message: string }).message).toMatch(/unauthorized/i);
  });

  it('should reject access to protected route with invalid JWT', async () => {
    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
    expect((res.body as { message: string }).message).toMatch(/unauthorized/i);
  });

  it('should allow access to protected route with valid JWT', async () => {
    // Register and login to get a valid token
    const uniqueEmail = `jwtuser+${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/auth/register').send({
      email: uniqueEmail,
      password: 'StrongPass123',
      firstName: 'JWT',
      lastName: 'User',
    });
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: uniqueEmail,
        password: 'StrongPass123',
      });
    const token = (loginRes.body as { access_token: string }).access_token;
    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.text).toBe('Protected route accessed');
  });
});
