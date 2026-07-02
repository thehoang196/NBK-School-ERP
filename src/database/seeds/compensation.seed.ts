import { DataSource } from 'typeorm';

/**
 * Seed data for Compensation Studio module.
 * Creates sample pay components, variables, formulas, and rules.
 */
export async function seedCompensation(dataSource: DataSource): Promise<void> {
  const schoolId = '550e8400-e29b-41d4-a716-446655440000'; // Default school from seed

  // 1. Pay Components
  const payComponents = [
    {
      id: '660e8400-0001-0001-0001-000000000001',
      school_id: schoolId,
      code: 'BASIC_SALARY',
      name: 'Lương cơ bản',
      type: 'earning',
      sort_order: 1,
      is_taxable: true,
      is_insurance_applicable: true,
      is_statutory: false,
      status: 'active',
    },
    {
      id: '660e8400-0001-0001-0001-000000000002',
      school_id: schoolId,
      code: 'TEACHING_ALLOWANCE',
      name: 'Phụ cấp giảng dạy',
      type: 'earning',
      sort_order: 2,
      is_taxable: true,
      is_insurance_applicable: false,
      is_statutory: false,
      status: 'active',
    },
    {
      id: '660e8400-0001-0001-0001-000000000003',
      school_id: schoolId,
      code: 'POSITION_ALLOWANCE',
      name: 'Phụ cấp chức vụ',
      type: 'earning',
      sort_order: 3,
      is_taxable: true,
      is_insurance_applicable: false,
      is_statutory: false,
      status: 'active',
    },
    {
      id: '660e8400-0001-0001-0001-000000000004',
      school_id: schoolId,
      code: 'BHXH',
      name: 'Bảo hiểm xã hội',
      type: 'deduction',
      sort_order: 10,
      is_taxable: false,
      is_insurance_applicable: false,
      is_statutory: true,
      status: 'active',
    },
    {
      id: '660e8400-0001-0001-0001-000000000005',
      school_id: schoolId,
      code: 'BHYT',
      name: 'Bảo hiểm y tế',
      type: 'deduction',
      sort_order: 11,
      is_taxable: false,
      is_insurance_applicable: false,
      is_statutory: true,
      status: 'active',
    },
  ];

  // 2. Variables
  const variables = [
    {
      id: '770e8400-0001-0001-0001-000000000001',
      code: 'LESSON_RATE',
      name: 'Đơn giá tiết dạy',
      data_type: 'number',
      default_value: '250000',
      scope: 'school',
      scope_id: schoolId,
      scope_level: null,
      description: 'Đơn giá mỗi tiết dạy (VND)',
    },
    {
      id: '770e8400-0001-0001-0001-000000000002',
      code: 'STANDARD_HOURS',
      name: 'Số tiết chuẩn',
      data_type: 'number',
      default_value: '40',
      scope: 'system',
      scope_id: null,
      scope_level: null,
      description: 'Số tiết chuẩn mỗi kỳ lương',
    },
    {
      id: '770e8400-0001-0001-0001-000000000003',
      code: 'OT_RATE',
      name: 'Phụ cấp vượt giờ',
      data_type: 'number',
      default_value: '50000',
      scope: 'school',
      scope_id: schoolId,
      scope_level: null,
      description: 'Phụ cấp mỗi tiết vượt giờ chuẩn',
    },
    {
      id: '770e8400-0001-0001-0001-000000000004',
      code: 'BHXH_RATE',
      name: 'Tỷ lệ BHXH',
      data_type: 'number',
      default_value: '0.08',
      scope: 'system',
      scope_id: null,
      scope_level: null,
      description: 'Tỷ lệ trích BHXH (8%)',
    },
    {
      id: '770e8400-0001-0001-0001-000000000005',
      code: 'BHYT_RATE',
      name: 'Tỷ lệ BHYT',
      data_type: 'number',
      default_value: '0.015',
      scope: 'system',
      scope_id: null,
      scope_level: null,
      description: 'Tỷ lệ trích BHYT (1.5%)',
    },
    {
      id: '770e8400-0001-0001-0001-000000000006',
      code: 'POSITION_AMOUNT',
      name: 'Mức phụ cấp chức vụ',
      data_type: 'number',
      default_value: '0',
      scope: 'school',
      scope_id: schoolId,
      scope_level: null,
      description: 'Mức phụ cấp chức vụ (set by rule)',
    },
    {
      id: '770e8400-0001-0001-0001-000000000007',
      code: 'TEACHING_HOURS',
      name: 'Số tiết dạy thực tế',
      data_type: 'number',
      default_value: '40',
      scope: 'school',
      scope_id: schoolId,
      scope_level: null,
      description: 'Số tiết dạy thực tế trong kỳ',
    },
  ];

  // Insert pay components
  for (const pc of payComponents) {
    await dataSource.query(
      `INSERT INTO pay_components (id, school_id, code, name, type, sort_order, is_taxable, is_insurance_applicable, is_statutory, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [pc.id, pc.school_id, pc.code, pc.name, pc.type, pc.sort_order, pc.is_taxable, pc.is_insurance_applicable, pc.is_statutory, pc.status],
    );
  }

  // Insert variables
  for (const v of variables) {
    await dataSource.query(
      `INSERT INTO compensation_variables (id, code, name, data_type, default_value, scope, scope_id, scope_level, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [v.id, v.code, v.name, v.data_type, v.default_value, v.scope, v.scope_id, v.scope_level, v.description],
    );
  }

  console.log('✅ Compensation seed data inserted');
}
