import { Injectable } from '@nestjs/common';
import { Workbook, Worksheet, Row } from 'exceljs';
import { ImportError } from '../dto/import-result.dto';

export interface ColumnMapping {
  header: string;
  field: string;
  required: boolean;
  validator?: (value: unknown) => string | null;
}

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, unknown>;
  errors: ImportError[];
}

@Injectable()
export class ImportProcessor {
  async parseExcelFile(buffer: Buffer): Promise<Workbook> {
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    return workbook;
  }

  parseWorksheet(
    worksheet: Worksheet,
    columnMappings: ColumnMapping[],
  ): ParsedRow[] {
    const results: ParsedRow[] = [];
    const headerRow = worksheet.getRow(1);
    const headerMap = this.buildHeaderMap(headerRow, columnMappings);

    worksheet.eachRow((row: Row, rowNumber: number) => {
      if (rowNumber === 1) return; // Skip header row

      const parsed = this.parseRow(row, rowNumber, columnMappings, headerMap);
      results.push(parsed);
    });

    return results;
  }

  private buildHeaderMap(
    headerRow: Row,
    columnMappings: ColumnMapping[],
  ): Map<string, number> {
    const map = new Map<string, number>();

    headerRow.eachCell((cell, colNumber) => {
      const headerValue = String(cell.value || '').trim().toLowerCase();
      const mapping = columnMappings.find(
        (m) => m.header.toLowerCase() === headerValue,
      );
      if (mapping) {
        map.set(mapping.field, colNumber);
      }
    });

    return map;
  }

  private parseRow(
    row: Row,
    rowNumber: number,
    columnMappings: ColumnMapping[],
    headerMap: Map<string, number>,
  ): ParsedRow {
    const data: Record<string, unknown> = {};
    const errors: ImportError[] = [];

    for (const mapping of columnMappings) {
      const colNumber = headerMap.get(mapping.field);
      let value: unknown = null;

      if (colNumber) {
        const cell = row.getCell(colNumber);
        value = cell.value;
      }

      // Check required
      if (mapping.required && (value === null || value === undefined || String(value).trim() === '')) {
        errors.push({
          row: rowNumber,
          field: mapping.field,
          message: `Trường "${mapping.header}" là bắt buộc`,
          value: String(value || ''),
        });
        continue;
      }

      // Run custom validator
      if (value !== null && value !== undefined && mapping.validator) {
        const errorMessage = mapping.validator(value);
        if (errorMessage) {
          errors.push({
            row: rowNumber,
            field: mapping.field,
            message: errorMessage,
            value: String(value),
          });
          continue;
        }
      }

      data[mapping.field] = value !== null && value !== undefined ? String(value).trim() : null;
    }

    return { rowNumber, data, errors };
  }

  getTeacherColumnMappings(): ColumnMapping[] {
    return [
      { header: 'Mã NV', field: 'employeeCode', required: true },
      { header: 'Họ và Tên', field: 'fullName', required: true },
      { header: 'Tên gọi', field: 'shortName', required: false },
      { header: 'Khối', field: 'gradeName', required: false },
      { header: 'Tổ bộ môn', field: 'departmentName', required: false },
      { header: 'Chức danh/chức vụ', field: 'jobTitle', required: false },
      { header: 'Cấp bậc quản lý', field: 'managementLevel', required: false },
      { header: 'Giới tính', field: 'gender', required: false },
      { header: 'Max tiết/tuần', field: 'maxPeriodsPerWeek', required: false, validator: this.validatePositiveNumber },
    ];
  }

  getSubjectColumnMappings(): ColumnMapping[] {
    return [
      { header: 'Môn học', field: 'name', required: true },
      { header: 'Số tiết/tuần', field: 'periodsPerWeek', required: false, validator: this.validatePositiveNumber },
    ];
  }

  getClassColumnMappings(): ColumnMapping[] {
    return [
      { header: 'Tên lớp', field: 'name', required: true },
      { header: 'Khối', field: 'gradeName', required: true },
      { header: 'Sĩ số', field: 'studentCount', required: false, validator: this.validatePositiveNumber },
      { header: 'GVCN', field: 'homeroomTeacherCode', required: false },
    ];
  }

  getDepartmentColumnMappings(): ColumnMapping[] {
    return [
      { header: 'Tổ bộ môn', field: 'name', required: true },
      { header: 'Mã Trường', field: 'schoolCode', required: false },
      { header: 'Tên Trường', field: 'schoolName', required: false },
      { header: 'Tên Tổ trưởng', field: 'headTeacherName', required: false },
      { header: 'Mã NV Tổ trưởng', field: 'headTeacherCode', required: false },
    ];
  }

  getTimetableColumnMappings(): ColumnMapping[] {
    return [
      { header: 'Lớp', field: 'className', required: true },
      { header: 'Thứ', field: 'dayOfWeek', required: true, validator: this.validateDayOfWeek },
      { header: 'Tiết', field: 'periodOrder', required: true, validator: this.validatePositiveNumber },
      { header: 'Môn', field: 'subjectCode', required: true },
      { header: 'Giáo viên', field: 'teacherCode', required: true },
      { header: 'Phòng', field: 'roomCode', required: false },
    ];
  }

  private validateEmail(value: unknown): string | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(String(value))) {
      return 'Email không đúng định dạng';
    }
    return null;
  }

  private validatePositiveNumber(value: unknown): string | null {
    const num = Number(value);
    if (isNaN(num) || num < 0) {
      return 'Giá trị phải là số không âm';
    }
    return null;
  }

  private validateDayOfWeek(value: unknown): string | null {
    const num = Number(value);
    if (isNaN(num) || num < 2 || num > 7) {
      return 'Thứ phải từ 2 đến 7 (Thứ 2 - Thứ 7)';
    }
    return null;
  }
}
