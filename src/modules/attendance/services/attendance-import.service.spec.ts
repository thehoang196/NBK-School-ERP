import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AttendanceImportService } from './attendance-import.service';
import { AttendanceRecordEntity } from '../entities/attendance-record.entity';
import { TeacherEntity } from '../../teacher/entities/teacher.entity';

describe('AttendanceImportService', () => {
  let service: AttendanceImportService;
  let mockRecordRepo: any;
  let mockTeacherRepo: any;
  let mockDataSource: any;

  const mockSchoolId = 'school-001';
  const mockUserId = 'user-001';

  beforeEach(async () => {
    mockRecordRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockTeacherRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 'teacher-001', employeeCode: 'GV001' },
        { id: 'teacher-002', employeeCode: 'GV002' },
      ]),
    };

    const mockManager = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((_entity, data) => data),
      save: jest.fn().mockImplementation((data) => data),
      update: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceImportService,
        {
          provide: getRepositoryToken(AttendanceRecordEntity),
          useValue: mockRecordRepo,
        },
        {
          provide: getRepositoryToken(TeacherEntity),
          useValue: mockTeacherRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get(AttendanceImportService);
  });

  describe('importFromExcel', () => {
    it('should handle empty worksheet gracefully', async () => {
      // Create a minimal xlsx buffer with empty sheet
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Sheet1');
      ws.addRow(['Mã NV', 'Ngày', 'Giờ vào', 'Giờ ra', 'Trạng thái', 'Tăng ca', 'Ghi chú']);
      // No data rows
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const result = await service.importFromExcel(buffer, mockSchoolId, mockUserId);

      expect(result.totalRows).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(0);
    });

    it('should validate employee codes and report errors', async () => {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Sheet1');
      ws.addRow(['Mã NV', 'Ngày', 'Giờ vào', 'Giờ ra', 'Trạng thái', 'Tăng ca', 'Ghi chú']);
      ws.addRow(['INVALID_CODE', '2026-07-01', '07:30', '17:00', 'Đi làm', '', '']);

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const result = await service.importFromExcel(buffer, mockSchoolId, mockUserId);

      expect(result.errorCount).toBe(1);
      expect(result.errors[0].message).toContain('Không tìm thấy giáo viên');
    });

    it('should validate date format', async () => {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Sheet1');
      ws.addRow(['Mã NV', 'Ngày', 'Giờ vào', 'Giờ ra', 'Trạng thái', 'Tăng ca', 'Ghi chú']);
      ws.addRow(['GV001', 'invalid-date', '07:30', '17:00', 'Đi làm', '', '']);

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const result = await service.importFromExcel(buffer, mockSchoolId, mockUserId);

      expect(result.errorCount).toBe(1);
      expect(result.errors[0].field).toBe('workDate');
    });

    it('should parse Vietnamese status names', async () => {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Sheet1');
      ws.addRow(['Mã NV', 'Ngày', 'Giờ vào', 'Giờ ra', 'Trạng thái', 'Tăng ca', 'Ghi chú']);
      ws.addRow(['GV001', '2026-07-01', '07:30', '17:00', 'Đi làm', '2', 'OK']);

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const result = await service.importFromExcel(buffer, mockSchoolId, mockUserId);

      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(0);
    });

    it('should accept DD/MM/YYYY date format', async () => {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Sheet1');
      ws.addRow(['Mã NV', 'Ngày', 'Giờ vào', 'Giờ ra', 'Trạng thái', 'Tăng ca', 'Ghi chú']);
      ws.addRow(['GV001', '01/07/2026', '07:30', '17:00', 'Đi làm', '', '']);

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const result = await service.importFromExcel(buffer, mockSchoolId, mockUserId);

      expect(result.successCount).toBe(1);
    });
  });
});
