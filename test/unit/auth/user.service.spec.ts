import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserService } from '../../../src/modules/auth/user.service';
import { UserRepository } from '../../../src/modules/auth/user.repository';
import { UserEntity } from '../../../src/modules/auth/entities/user.entity';
import { UserRole } from '../../../src/common/enums/role.enum';

jest.mock('bcrypt');

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<UserRepository>;

  const mockUser: UserEntity = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Nguyễn Văn A',
    email: 'nguyenvana@stms.vn',
    password: '$2b$10$hashedpassword',
    role: UserRole.TEACHER,
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

  const mockUser2: UserEntity = {
    id: '223e4567-e89b-12d3-a456-426614174000',
    name: 'Trần Thị B',
    email: 'tranthib@stms.vn',
    password: '$2b$10$hashedpassword2',
    role: UserRole.SCHOOL_ADMIN,
    schoolId: '123e4567-e89b-12d3-a456-426614174001',
    school: null,
    teacherId: null,
    teacher: null,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findAllFiltered: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(UserRepository) as jest.Mocked<UserRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated list of users', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'DESC' as const };
      userRepository.findAllFiltered.mockResolvedValue([[mockUser, mockUser2], 2]);

      const result = await service.findAll(query);

      expect(result).toEqual({ data: [mockUser, mockUser2], total: 2 });
      expect(userRepository.findAllFiltered).toHaveBeenCalledWith(query);
    });

    it('should return empty list when no users found', async () => {
      const query = { page: 1, limit: 10, sortOrder: 'DESC' as const };
      userRepository.findAllFiltered.mockResolvedValue([[], 0]);

      const result = await service.findAll(query);

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should pass query filters to repository', async () => {
      const query = {
        page: 1,
        limit: 10,
        sortOrder: 'DESC' as const,
        role: UserRole.TEACHER,
        schoolId: '123e4567-e89b-12d3-a456-426614174001',
        search: 'Nguyen',
      };
      userRepository.findAllFiltered.mockResolvedValue([[mockUser], 1]);

      await service.findAll(query);

      expect(userRepository.findAllFiltered).toHaveBeenCalledWith(query);
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const result = await service.findById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(userRepository.findById).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw NotFoundException when user not found', async () => {
      const nonExistentId = '999e4567-e89b-12d3-a456-426614174000';
      userRepository.findById.mockResolvedValue(null);

      await expect(service.findById(nonExistentId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById(nonExistentId)).rejects.toThrow(
        `Không tìm thấy người dùng với id: ${nonExistentId}`,
      );
    });
  });

  describe('create', () => {
    const createDto = {
      name: 'Lê Văn C',
      email: 'levanc@stms.vn',
      password: 'password123',
      role: UserRole.TEACHER,
      schoolId: '123e4567-e89b-12d3-a456-426614174001',
    };

    it('should create a new user successfully', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$newhash');
      const createdUser = {
        ...mockUser,
        name: createDto.name,
        email: createDto.email,
      };
      userRepository.create.mockResolvedValue(createdUser);

      const result = await service.create(createDto);

      expect(result).toEqual(createdUser);
      expect(userRepository.findByEmail).toHaveBeenCalledWith(createDto.email);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(userRepository.create).toHaveBeenCalledWith({
        name: createDto.name,
        email: createDto.email,
        password: '$2b$10$newhash',
        role: createDto.role,
        schoolId: createDto.schoolId,
        teacherId: null,
      });
    });

    it('should throw ConflictException when email already exists', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'Email đã tồn tại trong hệ thống',
      );
    });

    it('should handle creation without optional fields', async () => {
      const dtoWithoutOptional = {
        name: 'Super Admin',
        email: 'admin@stms.vn',
        password: 'admin123',
        role: UserRole.SUPER_ADMIN,
      };
      userRepository.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$adminhash');
      userRepository.create.mockResolvedValue({
        ...mockUser,
        schoolId: null,
        teacherId: null,
      });

      await service.create(dtoWithoutOptional);

      expect(userRepository.create).toHaveBeenCalledWith({
        name: dtoWithoutOptional.name,
        email: dtoWithoutOptional.email,
        password: '$2b$10$adminhash',
        role: dtoWithoutOptional.role,
        schoolId: null,
        teacherId: null,
      });
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Tên mới' };

    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, name: 'Tên mới' };
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue(updatedUser);

      const result = await service.update(mockUser.id, updateDto);

      expect(result).toEqual(updatedUser);
      expect(userRepository.findById).toHaveBeenCalledWith(mockUser.id);
      expect(userRepository.update).toHaveBeenCalledWith(mockUser.id, {
        name: 'Tên mới',
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      const nonExistentId = '999e4567-e89b-12d3-a456-426614174000';
      userRepository.findById.mockResolvedValue(null);

      await expect(
        service.update(nonExistentId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updating to existing email', async () => {
      const updateEmailDto = { email: 'tranthib@stms.vn' };
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.findByEmail.mockResolvedValue(mockUser2);

      await expect(
        service.update(mockUser.id, updateEmailDto),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.update(mockUser.id, updateEmailDto),
      ).rejects.toThrow('Email đã tồn tại trong hệ thống');
    });

    it('should allow updating to same email (no change)', async () => {
      const updateSameEmailDto = { email: mockUser.email };
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue(mockUser);

      const result = await service.update(mockUser.id, updateSameEmailDto);

      expect(result).toEqual(mockUser);
      // Should NOT call findByEmail since email is unchanged
      expect(userRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when update returns null', async () => {
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue(null);

      await expect(
        service.update(mockUser.id, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle schoolId and teacherId updates correctly', async () => {
      const updateWithSchoolDto = {
        schoolId: '333e4567-e89b-12d3-a456-426614174000',
        teacherId: '444e4567-e89b-12d3-a456-426614174000',
      };
      const updatedUser = {
        ...mockUser,
        schoolId: '333e4567-e89b-12d3-a456-426614174000',
        teacherId: '444e4567-e89b-12d3-a456-426614174000',
      };
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue(updatedUser);

      const result = await service.update(mockUser.id, updateWithSchoolDto);

      expect(result).toEqual(updatedUser);
      expect(userRepository.update).toHaveBeenCalledWith(mockUser.id, {
        schoolId: '333e4567-e89b-12d3-a456-426614174000',
        teacherId: '444e4567-e89b-12d3-a456-426614174000',
      });
    });
  });

  describe('remove', () => {
    it('should soft delete user successfully', async () => {
      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.softDelete.mockResolvedValue(undefined);

      await service.remove(mockUser.id);

      expect(userRepository.findById).toHaveBeenCalledWith(mockUser.id);
      expect(userRepository.softDelete).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw NotFoundException when user not found', async () => {
      const nonExistentId = '999e4567-e89b-12d3-a456-426614174000';
      userRepository.findById.mockResolvedValue(null);

      await expect(service.remove(nonExistentId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
