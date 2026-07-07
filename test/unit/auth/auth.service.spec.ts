import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { UserRepository } from '../../../src/modules/auth/user.repository';
import { UserEntity } from '../../../src/modules/auth/entities/user.entity';
import { UserRole } from '../../../src/common/enums/role.enum';
import { PasswordService } from '../../../src/modules/auth/services/password.service';
import { TeacherSchoolAssignmentService } from '../../../src/modules/teacher-school-assignment/teacher-school-assignment.service';
import { ContextSessionService } from '../../../src/modules/context/services/context-session.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let passwordService: jest.Mocked<PasswordService>;
  let teacherSchoolAssignmentService: jest.Mocked<TeacherSchoolAssignmentService>;
  let contextSessionService: jest.Mocked<ContextSessionService>;

  const mockUser: UserEntity = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test User',
    email: 'test@stms.vn',
    password: '$argon2id$v=19$m=65536,t=3,p=4$hashedpassword',
    role: UserRole.SCHOOL_ADMIN,
    schoolId: '123e4567-e89b-12d3-a456-426614174001',
    school: null,
    teacherId: null,
    teacher: null,
    companySchoolId: null,
    companySchool: null,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    version: 1,
  };

  beforeEach(async () => {
    const mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
    };

    const mockPasswordService = {
      hash: jest.fn(),
      verify: jest.fn(),
      needsRehash: jest.fn(),
    };

    const mockTeacherSchoolAssignmentService = {
      getAccessibleSchoolIds: jest.fn(),
    };

    const mockContextSessionService = {
      setActiveContext: jest.fn().mockResolvedValue(undefined),
      getActiveContext: jest.fn().mockResolvedValue(null),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      refreshTtl: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PasswordService, useValue: mockPasswordService },
        {
          provide: 'TEACHER_SCHOOL_ASSIGNMENT_SERVICE',
          useValue: mockTeacherSchoolAssignmentService,
        },
        {
          provide: 'CONTEXT_SESSION_SERVICE',
          useValue: mockContextSessionService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(UserRepository) as jest.Mocked<UserRepository>;
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
    passwordService = module.get(PasswordService) as jest.Mocked<PasswordService>;
    teacherSchoolAssignmentService = module.get(
      'TEACHER_SCHOOL_ASSIGNMENT_SERVICE',
    ) as jest.Mocked<TeacherSchoolAssignmentService>;
    contextSessionService = module.get(
      'CONTEXT_SESSION_SERVICE',
    ) as jest.Mocked<ContextSessionService>;

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const loginDto = { email: 'test@stms.vn', password: 'password123' };

    it('should login successfully with valid credentials', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      passwordService.verify.mockResolvedValue(true);
      passwordService.needsRehash.mockReturnValue(false);
      jwtService.sign.mockReturnValue('jwt-token');
      userRepository.update.mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(result).toEqual({
        accessToken: 'jwt-token',
        user: {
          id: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          role: mockUser.role,
          schoolId: mockUser.schoolId,
        },
      });
      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@stms.vn');
      expect(passwordService.verify).toHaveBeenCalledWith(
        'password123',
        mockUser.password,
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          schoolId: mockUser.schoolId,
          tokenVersion: expect.any(Number),
        }),
      );
      expect(userRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Email hoặc mật khẩu không đúng',
      );
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      passwordService.verify.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Email hoặc mật khẩu không đúng',
      );
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      userRepository.findByEmail.mockResolvedValue(inactiveUser);
      passwordService.verify.mockResolvedValue(true);
      passwordService.needsRehash.mockReturnValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Tài khoản đã bị khóa',
      );
    });

    it('should rehash password when using legacy bcrypt hash', async () => {
      const legacyUser = { ...mockUser, password: '$2b$10$oldbcrypthash' };
      userRepository.findByEmail.mockResolvedValue(legacyUser);
      passwordService.verify.mockResolvedValue(true);
      passwordService.needsRehash.mockReturnValue(true);
      passwordService.hash.mockResolvedValue('$argon2id$newhash');
      jwtService.sign.mockReturnValue('jwt-token');
      userRepository.update.mockResolvedValue(legacyUser);

      await service.login(loginDto);

      expect(passwordService.needsRehash).toHaveBeenCalledWith(legacyUser.password);
      expect(passwordService.hash).toHaveBeenCalledWith('password123');
      expect(userRepository.update).toHaveBeenCalledWith(
        legacyUser.id,
        expect.objectContaining({ password: '$argon2id$newhash' }),
      );
    });
  });

  describe('register', () => {
    const registerDto = {
      name: 'New User',
      email: 'new@stms.vn',
      password: 'password123',
      role: UserRole.TEACHER,
      schoolId: '123e4567-e89b-12d3-a456-426614174001',
    };

    it('should register a new user successfully', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue('$argon2id$hashedpassword');
      const createdUser = {
        ...mockUser,
        name: registerDto.name,
        email: registerDto.email,
        role: registerDto.role,
      };
      userRepository.create.mockResolvedValue(createdUser);

      const result = await service.register(registerDto);

      expect(result).toEqual(createdUser);
      expect(userRepository.findByEmail).toHaveBeenCalledWith('new@stms.vn');
      expect(passwordService.hash).toHaveBeenCalledWith('password123');
      expect(userRepository.create).toHaveBeenCalledWith({
        name: registerDto.name,
        email: registerDto.email,
        password: '$argon2id$hashedpassword',
        role: registerDto.role,
        schoolId: registerDto.schoolId,
      });
    });

    it('should throw ConflictException when email already exists', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'Email đã tồn tại',
      );
    });

    it('should handle registration without schoolId', async () => {
      const dtoWithoutSchool = { ...registerDto, schoolId: undefined };
      userRepository.findByEmail.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue('$argon2id$hashedpassword');
      userRepository.create.mockResolvedValue(mockUser);

      await service.register(dtoWithoutSchool);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: null }),
      );
    });
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      passwordService.verify.mockResolvedValue(true);
      passwordService.needsRehash.mockReturnValue(false);

      const result = await service.validateUser('test@stms.vn', 'password123');

      expect(result).toEqual(mockUser);
      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@stms.vn');
      expect(passwordService.verify).toHaveBeenCalledWith(
        'password123',
        mockUser.password,
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.validateUser('unknown@stms.vn', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      passwordService.verify.mockResolvedValue(false);

      await expect(
        service.validateUser('test@stms.vn', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      userRepository.findByEmail.mockResolvedValue(inactiveUser);
      passwordService.verify.mockResolvedValue(true);
      passwordService.needsRehash.mockReturnValue(false);

      await expect(
        service.validateUser('test@stms.vn', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('generateToken', () => {
    it('should generate a JWT token with correct payload including tokenVersion', async () => {
      jwtService.sign.mockReturnValue('jwt-token');

      const result = await service.generateToken(mockUser);

      expect(result).toBe('jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          schoolId: mockUser.schoolId,
          tokenVersion: expect.any(Number),
        }),
      );
    });

    it('should include accessibleSchoolIds for teacher users', async () => {
      const teacherUser: UserEntity = {
        ...mockUser,
        role: UserRole.TEACHER,
        teacherId: '123e4567-e89b-12d3-a456-426614174099',
      };
      const accessibleSchools = [
        '123e4567-e89b-12d3-a456-426614174001',
        '123e4567-e89b-12d3-a456-426614174002',
      ];
      teacherSchoolAssignmentService.getAccessibleSchoolIds.mockResolvedValue(
        accessibleSchools,
      );
      jwtService.sign.mockReturnValue('jwt-token-teacher');

      const result = await service.generateToken(teacherUser);

      expect(result).toBe('jwt-token-teacher');
      expect(
        teacherSchoolAssignmentService.getAccessibleSchoolIds,
      ).toHaveBeenCalledWith(teacherUser.teacherId);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: teacherUser.id,
          email: teacherUser.email,
          role: teacherUser.role,
          schoolId: teacherUser.schoolId,
          accessibleSchoolIds: accessibleSchools,
          tokenVersion: expect.any(Number),
        }),
      );
    });

    it('should not include accessibleSchoolIds for non-teacher users', async () => {
      jwtService.sign.mockReturnValue('jwt-token');

      await service.generateToken(mockUser);

      expect(
        teacherSchoolAssignmentService.getAccessibleSchoolIds,
      ).not.toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.not.objectContaining({ accessibleSchoolIds: expect.anything() }),
      );
    });

    it('should fallback to schoolId if getAccessibleSchoolIds fails', async () => {
      const teacherUser: UserEntity = {
        ...mockUser,
        role: UserRole.TEACHER,
        teacherId: '123e4567-e89b-12d3-a456-426614174099',
      };
      teacherSchoolAssignmentService.getAccessibleSchoolIds.mockRejectedValue(
        new Error('DB connection error'),
      );
      jwtService.sign.mockReturnValue('jwt-token-fallback');

      const result = await service.generateToken(teacherUser);

      expect(result).toBe('jwt-token-fallback');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          accessibleSchoolIds: [teacherUser.schoolId],
        }),
      );
    });

    it('should not include accessibleSchoolIds if teacher has no teacherId', async () => {
      const teacherUserNoTeacherId: UserEntity = {
        ...mockUser,
        role: UserRole.TEACHER,
        teacherId: null,
      };
      jwtService.sign.mockReturnValue('jwt-token');

      await service.generateToken(teacherUserNoTeacherId);

      expect(
        teacherSchoolAssignmentService.getAccessibleSchoolIds,
      ).not.toHaveBeenCalled();
    });

    it('should set tokenVersion as unix timestamp in seconds', async () => {
      jwtService.sign.mockReturnValue('jwt-token');
      const before = Math.floor(Date.now() / 1000);

      await service.generateToken(mockUser);

      const signCall = jwtService.sign.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const after = Math.floor(Date.now() / 1000);
      expect(signCall.tokenVersion).toBeGreaterThanOrEqual(before);
      expect(signCall.tokenVersion).toBeLessThanOrEqual(after);
    });
  });

  describe('findUserById', () => {
    it('should return user when found', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const result = await service.findUserById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(userRepository.findById).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return null when user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      const result = await service.findUserById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  // ─── logout (Session Cleanup) ─────────────────────────────────────────────────

  describe('logout', () => {
    it('should call deleteSession on contextSessionService with userId', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      await service.logout(userId);

      expect(contextSessionService.deleteSession).toHaveBeenCalledWith(userId);
      expect(contextSessionService.deleteSession).toHaveBeenCalledTimes(1);
    });

    it('should not throw when contextSessionService.deleteSession succeeds', async () => {
      contextSessionService.deleteSession.mockResolvedValue(undefined);

      await expect(service.logout(mockUser.id)).resolves.toBeUndefined();
    });

    it('should not throw when contextSessionService.deleteSession fails (non-blocking)', async () => {
      contextSessionService.deleteSession.mockRejectedValue(
        new Error('Redis connection refused'),
      );

      // Logout MUST succeed even if Redis is unavailable
      await expect(service.logout(mockUser.id)).resolves.toBeUndefined();
    });

    it('should log warning when deleteSession fails', async () => {
      contextSessionService.deleteSession.mockRejectedValue(
        new Error('Redis timeout'),
      );

      await service.logout(mockUser.id);

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete context session on logout'),
      );
    });
  });
});
