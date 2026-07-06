import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { UserRepository } from '../../../src/modules/auth/user.repository';
import { UserEntity } from '../../../src/modules/auth/entities/user.entity';
import { UserRole } from '../../../src/common/enums/role.enum';
import { TeacherSchoolAssignmentService } from '../../../src/modules/teacher-school-assignment/teacher-school-assignment.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let teacherSchoolAssignmentService: jest.Mocked<TeacherSchoolAssignmentService>;

  const mockUser: UserEntity = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test User',
    email: 'test@stms.vn',
    password: '$2b$10$hashedpassword',
    role: UserRole.SCHOOL_ADMIN,
    schoolId: '123e4567-e89b-12d3-a456-426614174001',
    school: null,
    teacherId: null,
    teacher: null,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
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

    const mockTeacherSchoolAssignmentService = {
      getAccessibleSchoolIds: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
        {
          provide: 'TEACHER_SCHOOL_ASSIGNMENT_SERVICE',
          useValue: mockTeacherSchoolAssignmentService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(UserRepository) as jest.Mocked<UserRepository>;
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
    teacherSchoolAssignmentService = module.get(
      'TEACHER_SCHOOL_ASSIGNMENT_SERVICE',
    ) as jest.Mocked<TeacherSchoolAssignmentService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const loginDto = { email: 'test@stms.vn', password: 'password123' };

    it('should login successfully with valid credentials', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
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
      expect(bcrypt.compare).toHaveBeenCalledWith(
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
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

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
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Tài khoản đã bị khóa',
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
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedpassword');
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
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(userRepository.create).toHaveBeenCalledWith({
        name: registerDto.name,
        email: registerDto.email,
        password: '$2b$10$hashedpassword',
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
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedpassword');
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
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@stms.vn', 'password123');

      expect(result).toEqual(mockUser);
      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@stms.vn');
      expect(bcrypt.compare).toHaveBeenCalledWith(
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
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser('test@stms.vn', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      userRepository.findByEmail.mockResolvedValue(inactiveUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

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
});
