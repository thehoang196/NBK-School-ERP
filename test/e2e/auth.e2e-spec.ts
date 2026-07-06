import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../../src/modules/auth/auth.controller';
import { AuthService, LoginResponse } from '../../src/modules/auth/auth.service';
import { UserRole } from '../../src/common/enums/role.enum';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * E2E Tests — Authentication Flow
 *
 * Tests login, invalid credentials, and register.
 * Uses mocked AuthService (no real DB/JWT required).
 */

describe('Auth E2E', () => {
  let app: INestApplication;
  let mockAuthService: Record<string, jest.Mock>;

  const mockLoginResponse: LoginResponse = {
    accessToken: 'mock-jwt-token-xxxx',
    user: {
      id: 'user-uuid-1',
      name: 'Admin NBK',
      email: 'admin@nbk.edu.vn',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: 'school-uuid-1',
    },
  };

  const mockUser = {
    id: 'user-uuid-2',
    name: 'New User',
    email: 'newuser@nbk.edu.vn',
    role: UserRole.TEACHER,
    schoolId: 'school-uuid-1',
  };

  beforeAll(async () => {
    mockAuthService = {
      login: jest.fn(),
      register: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(
      new (await import('../../src/common/filters/http-exception.filter')).GlobalExceptionFilter(),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Login ────────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with valid credentials (200)', async () => {
      mockAuthService.login.mockResolvedValue(mockLoginResponse);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@nbk.edu.vn', password: 'Str0ngP@ss123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken', 'mock-jwt-token-xxxx');
      expect(res.body.user).toHaveProperty('email', 'admin@nbk.edu.vn');
      expect(res.body.user).toHaveProperty('role', UserRole.SCHOOL_ADMIN);
    });

    it('should reject invalid credentials (401)', async () => {
      const { UnauthorizedException } = await import('@nestjs/common');
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Email hoặc mật khẩu không đúng'),
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@nbk.edu.vn', password: 'wrong-password' });

      expect(res.status).toBe(401);
    });

    it('should reject missing email (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ password: 'Str0ngP@ss123' });

      expect(res.status).toBe(400);
    });

    it('should reject missing password (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@nbk.edu.vn' });

      expect(res.status).toBe(400);
    });
  });

  // ─── Register ─────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully (201)', async () => {
      mockAuthService.register.mockResolvedValue(mockUser);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'New User',
          email: 'newuser@nbk.edu.vn',
          password: 'Str0ngP@ss123',
          role: UserRole.TEACHER,
          schoolId: '00000000-0000-4000-a000-000000000001',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', 'user-uuid-2');
      expect(res.body).toHaveProperty('email', 'newuser@nbk.edu.vn');
    });

    it('should reject duplicate email (409)', async () => {
      const { ConflictException } = await import('@nestjs/common');
      mockAuthService.register.mockRejectedValue(
        new ConflictException('Email đã tồn tại'),
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Dup User',
          email: 'admin@nbk.edu.vn',
          password: 'Str0ngP@ss123',
          role: UserRole.TEACHER,
          schoolId: '00000000-0000-4000-a000-000000000001',
        });

      expect(res.status).toBe(409);
    });
  });
});
