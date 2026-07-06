import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SalarySlipEntity } from '../entities/salary-slip.entity';
import { PayrollRunEntity } from '../entities/payroll-run.entity';

export interface PayrollSummaryReport {
  payPeriodId: string;
  totalTeachers: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  averageSalary: number;
}

export interface TeacherIncomeReport {
  teacherId: string;
  teacherName: string;
  grossAmount: number;
  totalDeductions: number;
  netAmount: number;
  earnings: { code: string; name: string; amount: number }[];
}

export interface OvertimeReport {
  teacherId: string;
  teacherName: string;
  totalOvertimeHours: number;
  overtimeAmount: number;
}

export interface PayrollCostBySchoolReport {
  schoolId: string;
  schoolName: string;
  totalGross: number;
  totalNet: number;
  teacherCount: number;
}

@Injectable()
export class PayrollReportingService {
  private readonly logger = new Logger(PayrollReportingService.name);

  constructor(
    @InjectRepository(SalarySlipEntity)
    private readonly salarySlipRepo: Repository<SalarySlipEntity>,
    @InjectRepository(PayrollRunEntity)
    private readonly payrollRunRepo: Repository<PayrollRunEntity>,
  ) {}

  /**
   * Báo cáo tổng hợp lương theo kỳ.
   */
  async getPayrollSummary(
    schoolId: string,
    payPeriodId: string,
  ): Promise<PayrollSummaryReport> {
    const result = await this.salarySlipRepo
      .createQueryBuilder('slip')
      .select('COUNT(*)', 'totalTeachers')
      .addSelect('COALESCE(SUM(slip.gross_amount), 0)', 'totalGross')
      .addSelect('COALESCE(SUM(slip.total_deductions), 0)', 'totalDeductions')
      .addSelect('COALESCE(SUM(slip.net_amount), 0)', 'totalNet')
      .addSelect('COALESCE(AVG(slip.net_amount), 0)', 'averageSalary')
      .where('slip.school_id = :schoolId', { schoolId })
      .andWhere('slip.pay_period_id = :payPeriodId', { payPeriodId })
      .andWhere('slip.deleted_at IS NULL')
      .getRawOne();

    return {
      payPeriodId,
      totalTeachers: parseInt(result.totalTeachers, 10),
      totalGross: parseFloat(result.totalGross),
      totalDeductions: parseFloat(result.totalDeductions),
      totalNet: parseFloat(result.totalNet),
      averageSalary: Math.round(parseFloat(result.averageSalary)),
    };
  }

  /**
   * Báo cáo chi tiết thu nhập theo giáo viên.
   */
  async getTeacherIncomeReport(
    schoolId: string,
    payPeriodId: string,
  ): Promise<TeacherIncomeReport[]> {
    const slips = await this.salarySlipRepo.find({
      where: {
        schoolId,
        payPeriodId,
        deletedAt: IsNull(),
      },
      relations: ['teacher'],
      order: { grossAmount: 'DESC' },
    });

    return slips.map((slip) => ({
      teacherId: slip.teacherId,
      teacherName: slip.teacher?.fullName || 'N/A',
      grossAmount: Number(slip.grossAmount),
      totalDeductions: Number(slip.totalDeductions),
      netAmount: Number(slip.netAmount),
      earnings: (slip.earnings || []).map((e) => ({
        code: e.payComponentCode,
        name: e.payComponentName,
        amount: e.amount,
      })),
    }));
  }

  /**
   * Báo cáo tổng hợp vượt giờ/tăng ca.
   */
  async getOvertimeReport(
    schoolId: string,
    payPeriodId: string,
  ): Promise<OvertimeReport[]> {
    const slips = await this.salarySlipRepo.find({
      where: {
        schoolId,
        payPeriodId,
        deletedAt: IsNull(),
      },
      relations: ['teacher'],
    });

    return slips
      .map((slip) => {
        // Extract overtime-related earnings from snapshot/earnings
        const overtimeEarnings = (slip.earnings || []).filter(
          (e) =>
            e.payComponentCode.includes('TANG_CA') ||
            e.payComponentCode.includes('OVERTIME') ||
            e.payComponentCode.includes('VUOT_GIO'),
        );
        const overtimeAmount = overtimeEarnings.reduce((sum, e) => sum + e.amount, 0);

        // Get overtime hours from snapshot variables
        const overtimeHours = slip.snapshot?.variables?.['TANG_CA'] || 0;

        return {
          teacherId: slip.teacherId,
          teacherName: slip.teacher?.fullName || 'N/A',
          totalOvertimeHours: Number(overtimeHours),
          overtimeAmount,
        };
      })
      .filter((r) => r.totalOvertimeHours > 0 || r.overtimeAmount > 0)
      .sort((a, b) => b.overtimeAmount - a.overtimeAmount);
  }

  /**
   * Báo cáo chi phí lương theo trường (cho SUPER_ADMIN).
   */
  async getPayrollCostBySchool(
    payPeriodId: string,
  ): Promise<PayrollCostBySchoolReport[]> {
    const results = await this.salarySlipRepo
      .createQueryBuilder('slip')
      .select('slip.school_id', 'schoolId')
      .addSelect('COUNT(*)', 'teacherCount')
      .addSelect('COALESCE(SUM(slip.gross_amount), 0)', 'totalGross')
      .addSelect('COALESCE(SUM(slip.net_amount), 0)', 'totalNet')
      .innerJoin('slip.school', 'school')
      .addSelect('school.name', 'schoolName')
      .where('slip.pay_period_id = :payPeriodId', { payPeriodId })
      .andWhere('slip.deleted_at IS NULL')
      .groupBy('slip.school_id')
      .addGroupBy('school.name')
      .orderBy('"totalGross"', 'DESC')
      .getRawMany();

    return results.map((r) => ({
      schoolId: r.schoolId,
      schoolName: r.schoolName,
      totalGross: parseFloat(r.totalGross),
      totalNet: parseFloat(r.totalNet),
      teacherCount: parseInt(r.teacherCount, 10),
    }));
  }
}
