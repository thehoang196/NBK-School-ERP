import { DataSource } from 'typeorm';

/**
 * Seed NBK Compensation Defaults.
 *
 * Pay Components theo bảng lương NBK:
 * - LUONG_KHOAN, LUONG_TRACH_NHIEM, LUONG_NGHIEP_VU (fixed)
 * - LUONG_TIET, TIET_THEO_BO, TIET_TOAN_VAN_ANH, TIET_HUAN_LUYEN, TIET_LUYEN_THI,
 *   TIET_IELTS, TIET_CLB, LUONG_TIET_TAM_LY (teaching-based)
 * - RA_DE, TANG_CA, THUONG_PHAT_SINH, AN_CA, GUI_XE, THUONG_DA_CHI (other earnings)
 * - TOTAL_FIXED_SALARY, TOTAL_TEACHING_SALARY, TOTAL_INCOME (aggregates)
 *
 * Variables:
 * - CONG_CHUAN, TIEN_IELTS, LUONG_TIET, HE_SO_TOAN_VAN_ANH, etc.
 *
 * Formulas:
 * - TOTAL_FIXED_SALARY = LUONG_KHOAN + LUONG_TRACH_NHIEM + LUONG_NGHIEP_VU
 * - TOTAL_TEACHING_SALARY = sum of all teaching components
 * - TOTAL_INCOME = TOTAL_FIXED_SALARY + TOTAL_TEACHING_SALARY + extras
 *
 * Idempotent: ON CONFLICT DO NOTHING.
 */
export async function seedCompensationNbkDefaults(
  dataSource: DataSource,
): Promise<void> {
  // Find school NBK-TH
  const schools = await dataSource.query(
    `SELECT id FROM schools WHERE code = 'NBK-TH' AND deleted_at IS NULL LIMIT 1`,
  );
  if (!schools.length) {
    console.log(
      '⚠️  School NBK-TH not found, skipping NBK compensation defaults seed.',
    );
    return;
  }
  const schoolId = schools[0].id;

  console.log('💰 Seeding NBK Compensation Defaults...');

  // ═══════════════════════════════════════════════
  // 1. PAY COMPONENTS
  // ═══════════════════════════════════════════════
  const payComponents = [
    // Fixed salary components
    { code: 'LUONG_KHOAN', name: 'Lương khoán', type: 'earning', sort_order: 1, is_taxable: true, is_insurance_applicable: true },
    { code: 'LUONG_TRACH_NHIEM', name: 'Lương trách nhiệm', type: 'earning', sort_order: 2, is_taxable: true, is_insurance_applicable: false },
    { code: 'LUONG_NGHIEP_VU', name: 'Lương nghiệp vụ', type: 'earning', sort_order: 3, is_taxable: true, is_insurance_applicable: false },
    // Teaching-based components
    { code: 'LUONG_TIET', name: 'Lương tiết (theo bộ)', type: 'earning', sort_order: 10, is_taxable: true, is_insurance_applicable: false },
    { code: 'TIET_THEO_BO', name: 'Tiết theo bộ', type: 'earning', sort_order: 11, is_taxable: true, is_insurance_applicable: false },
    { code: 'TIET_TOAN_VAN_ANH', name: 'Tiết Toán-Văn-Anh', type: 'earning', sort_order: 12, is_taxable: true, is_insurance_applicable: false },
    { code: 'TIET_HUAN_LUYEN', name: 'Tiết huấn luyện', type: 'earning', sort_order: 13, is_taxable: true, is_insurance_applicable: false },
    { code: 'TIET_LUYEN_THI', name: 'Tiết luyện thi', type: 'earning', sort_order: 14, is_taxable: true, is_insurance_applicable: false },
    { code: 'TIET_IELTS', name: 'Tiết IELTS', type: 'earning', sort_order: 15, is_taxable: true, is_insurance_applicable: false },
    { code: 'TIET_CLB', name: 'Tiết CLB', type: 'earning', sort_order: 16, is_taxable: true, is_insurance_applicable: false },
    { code: 'LUONG_TIET_TAM_LY', name: 'Lương tiết tâm lý', type: 'earning', sort_order: 17, is_taxable: true, is_insurance_applicable: false },
    // Other earnings
    { code: 'RA_DE', name: 'Ra đề', type: 'earning', sort_order: 20, is_taxable: true, is_insurance_applicable: false },
    { code: 'TANG_CA', name: 'Tăng ca', type: 'earning', sort_order: 21, is_taxable: true, is_insurance_applicable: false },
    { code: 'THUONG_PHAT_SINH', name: 'Thưởng phát sinh', type: 'earning', sort_order: 22, is_taxable: true, is_insurance_applicable: false },
    { code: 'AN_CA', name: 'Ăn ca', type: 'earning', sort_order: 23, is_taxable: false, is_insurance_applicable: false },
    { code: 'GUI_XE', name: 'Gửi xe', type: 'earning', sort_order: 24, is_taxable: false, is_insurance_applicable: false },
    { code: 'THUONG_DA_CHI', name: 'Thưởng đã chi', type: 'earning', sort_order: 25, is_taxable: true, is_insurance_applicable: false },
    // Aggregates
    { code: 'TOTAL_FIXED_SALARY', name: 'Tổng lương cố định', type: 'earning', sort_order: 90, is_taxable: false, is_insurance_applicable: false },
    { code: 'TOTAL_TEACHING_SALARY', name: 'Tổng lương dạy', type: 'earning', sort_order: 91, is_taxable: false, is_insurance_applicable: false },
    { code: 'TOTAL_INCOME', name: 'Tổng thu nhập', type: 'earning', sort_order: 99, is_taxable: false, is_insurance_applicable: false },
  ];

  for (const pc of payComponents) {
    await dataSource.query(
      `INSERT INTO pay_components (id, school_id, code, name, type, sort_order, is_taxable, is_insurance_applicable, is_statutory, status, version)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, 'active', 1)
       ON CONFLICT DO NOTHING`,
      [schoolId, pc.code, pc.name, pc.type, pc.sort_order, pc.is_taxable, pc.is_insurance_applicable],
    );
  }
  console.log('  ✅ NBK Pay Components seeded');

  // ═══════════════════════════════════════════════
  // 2. VARIABLES
  // ═══════════════════════════════════════════════
  const variables = [
    { code: 'CONG_CHUAN', name: 'Công chuẩn', data_type: 'number', default_value: '26', scope: 'system', description: 'Số ngày công chuẩn trong tháng' },
    { code: 'LUONG_TIET_RATE', name: 'Đơn giá tiết dạy', data_type: 'number', default_value: '200000', scope: 'school', description: 'Đơn giá 1 tiết dạy (VND)' },
    { code: 'TIEN_IELTS', name: 'Đơn giá tiết IELTS', data_type: 'number', default_value: '350000', scope: 'school', description: 'Đơn giá 1 tiết IELTS' },
    { code: 'HE_SO_TOAN_VAN_ANH', name: 'Hệ số tiết Toán-Văn-Anh', data_type: 'number', default_value: '1.2', scope: 'school', description: 'Hệ số nhân cho tiết Toán, Văn, Anh' },
    { code: 'HE_SO_HUAN_LUYEN', name: 'Hệ số tiết huấn luyện', data_type: 'number', default_value: '1.5', scope: 'school', description: 'Hệ số nhân cho tiết huấn luyện' },
    { code: 'HE_SO_LUYEN_THI', name: 'Hệ số tiết luyện thi', data_type: 'number', default_value: '1.3', scope: 'school', description: 'Hệ số nhân cho tiết luyện thi' },
    { code: 'TIEN_CLB', name: 'Đơn giá tiết CLB', data_type: 'number', default_value: '150000', scope: 'school', description: 'Đơn giá 1 tiết CLB' },
    { code: 'TIEN_TAM_LY', name: 'Đơn giá tiết tâm lý', data_type: 'number', default_value: '300000', scope: 'school', description: 'Đơn giá 1 tiết tâm lý' },
    { code: 'AN_CA_RATE', name: 'Mức ăn ca/ngày', data_type: 'number', default_value: '35000', scope: 'school', description: 'Tiền ăn ca 1 ngày' },
    { code: 'GUI_XE_RATE', name: 'Mức gửi xe/tháng', data_type: 'number', default_value: '100000', scope: 'school', description: 'Tiền gửi xe/tháng' },
    { code: 'TANG_CA_RATE', name: 'Đơn giá tăng ca/giờ', data_type: 'number', default_value: '100000', scope: 'school', description: 'Đơn giá 1 giờ tăng ca' },
    // Teaching metrics variables (resolved at runtime)
    { code: 'TIET_REGULAR', name: 'Số tiết thường', data_type: 'number', default_value: '0', scope: 'school', description: 'Số tiết dạy thường (auto-resolved)' },
    { code: 'TIET_TVA', name: 'Số tiết Toán-Văn-Anh', data_type: 'number', default_value: '0', scope: 'school', description: 'Số tiết Toán/Văn/Anh (auto-resolved)' },
    { code: 'TIET_HL', name: 'Số tiết huấn luyện', data_type: 'number', default_value: '0', scope: 'school', description: 'Số tiết huấn luyện (auto-resolved)' },
    { code: 'TIET_LT', name: 'Số tiết luyện thi', data_type: 'number', default_value: '0', scope: 'school', description: 'Số tiết luyện thi (auto-resolved)' },
    { code: 'TIET_IELTS_COUNT', name: 'Số tiết IELTS', data_type: 'number', default_value: '0', scope: 'school', description: 'Số tiết IELTS (auto-resolved)' },
    { code: 'TIET_CLB_COUNT', name: 'Số tiết CLB', data_type: 'number', default_value: '0', scope: 'school', description: 'Số tiết CLB (auto-resolved)' },
    { code: 'TIET_TL', name: 'Số tiết tâm lý', data_type: 'number', default_value: '0', scope: 'school', description: 'Số tiết tâm lý (auto-resolved)' },
  ];

  for (const v of variables) {
    await dataSource.query(
      `INSERT INTO compensation_variables (id, code, name, data_type, default_value, scope, scope_id, scope_level, description, version)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NULL, $7, 1)
       ON CONFLICT DO NOTHING`,
      [v.code, v.name, v.data_type, v.default_value, v.scope, v.scope === 'school' ? schoolId : null, v.description],
    );
  }
  console.log('  ✅ NBK Variables seeded');

  // ═══════════════════════════════════════════════
  // 3. FORMULAS (3 công thức NBK chính)
  // ═══════════════════════════════════════════════

  // Get pay component IDs
  const pcRows = await dataSource.query(
    `SELECT id, code FROM pay_components WHERE school_id = $1 AND deleted_at IS NULL`,
    [schoolId],
  );
  const pcMap = new Map<string, string>();
  for (const row of pcRows) {
    pcMap.set(row.code, row.id);
  }

  const formulas = [
    {
      code: 'TOTAL_FIXED_SALARY',
      expression: 'LUONG_KHOAN + LUONG_TRACH_NHIEM + LUONG_NGHIEP_VU',
      dependencies: ['LUONG_KHOAN', 'LUONG_TRACH_NHIEM', 'LUONG_NGHIEP_VU'],
      variableRefs: [],
    },
    {
      code: 'TOTAL_TEACHING_SALARY',
      expression: 'TIET_THEO_BO + TIET_TOAN_VAN_ANH + TIET_HUAN_LUYEN + TIET_LUYEN_THI + TIET_IELTS + TIET_CLB + LUONG_TIET_TAM_LY',
      dependencies: ['TIET_THEO_BO', 'TIET_TOAN_VAN_ANH', 'TIET_HUAN_LUYEN', 'TIET_LUYEN_THI', 'TIET_IELTS', 'TIET_CLB', 'LUONG_TIET_TAM_LY'],
      variableRefs: [],
    },
    {
      code: 'TOTAL_INCOME',
      expression: 'TOTAL_FIXED_SALARY + TOTAL_TEACHING_SALARY + RA_DE + TANG_CA + THUONG_PHAT_SINH + AN_CA + GUI_XE + THUONG_DA_CHI',
      dependencies: ['TOTAL_FIXED_SALARY', 'TOTAL_TEACHING_SALARY', 'RA_DE', 'TANG_CA', 'THUONG_PHAT_SINH', 'AN_CA', 'GUI_XE', 'THUONG_DA_CHI'],
      variableRefs: [],
    },
    // Teaching component formulas
    {
      code: 'TIET_THEO_BO',
      expression: 'TIET_REGULAR * LUONG_TIET_RATE',
      dependencies: [],
      variableRefs: ['TIET_REGULAR', 'LUONG_TIET_RATE'],
    },
    {
      code: 'TIET_TOAN_VAN_ANH',
      expression: 'TIET_TVA * LUONG_TIET_RATE * HE_SO_TOAN_VAN_ANH',
      dependencies: [],
      variableRefs: ['TIET_TVA', 'LUONG_TIET_RATE', 'HE_SO_TOAN_VAN_ANH'],
    },
    {
      code: 'TIET_HUAN_LUYEN',
      expression: 'TIET_HL * LUONG_TIET_RATE * HE_SO_HUAN_LUYEN',
      dependencies: [],
      variableRefs: ['TIET_HL', 'LUONG_TIET_RATE', 'HE_SO_HUAN_LUYEN'],
    },
    {
      code: 'TIET_LUYEN_THI',
      expression: 'TIET_LT * LUONG_TIET_RATE * HE_SO_LUYEN_THI',
      dependencies: [],
      variableRefs: ['TIET_LT', 'LUONG_TIET_RATE', 'HE_SO_LUYEN_THI'],
    },
    {
      code: 'TIET_IELTS',
      expression: 'TIET_IELTS_COUNT * TIEN_IELTS',
      dependencies: [],
      variableRefs: ['TIET_IELTS_COUNT', 'TIEN_IELTS'],
    },
    {
      code: 'TIET_CLB',
      expression: 'TIET_CLB_COUNT * TIEN_CLB',
      dependencies: [],
      variableRefs: ['TIET_CLB_COUNT', 'TIEN_CLB'],
    },
    {
      code: 'LUONG_TIET_TAM_LY',
      expression: 'TIET_TL * TIEN_TAM_LY',
      dependencies: [],
      variableRefs: ['TIET_TL', 'TIEN_TAM_LY'],
    },
    {
      code: 'AN_CA',
      expression: 'NGAY_CONG * AN_CA_RATE',
      dependencies: [],
      variableRefs: ['NGAY_CONG', 'AN_CA_RATE'],
    },
    {
      code: 'TANG_CA',
      expression: 'TANG_CA * TANG_CA_RATE',
      dependencies: [],
      variableRefs: ['TANG_CA', 'TANG_CA_RATE'],
    },
  ];

  for (const f of formulas) {
    const payComponentId = pcMap.get(f.code);
    if (!payComponentId) {
      console.log(`  ⚠️  Pay component ${f.code} not found, skipping formula`);
      continue;
    }

    // Check if formula already exists for this pay component
    const existing = await dataSource.query(
      `SELECT id FROM formulas WHERE pay_component_id = $1 AND school_id = $2 AND status = 'published' AND deleted_at IS NULL LIMIT 1`,
      [payComponentId, schoolId],
    );
    if (existing.length > 0) continue;

    await dataSource.query(
      `INSERT INTO formulas (id, pay_component_id, school_id, expression, parsed_ast, dependencies, variable_refs, formula_version, changelog, status, version)
       VALUES (gen_random_uuid(), $1, $2, $3, NULL, $4, $5, 1, 'NBK default formula', 'published', 1)
       ON CONFLICT DO NOTHING`,
      [
        payComponentId,
        schoolId,
        f.expression,
        JSON.stringify(f.dependencies),
        JSON.stringify(f.variableRefs),
      ],
    );
  }
  console.log('  ✅ NBK Formulas seeded');

  // ═══════════════════════════════════════════════
  // 4. RULES (mẫu)
  // ═══════════════════════════════════════════════
  const existingRules = await dataSource.query(
    `SELECT id FROM compensation_rules WHERE school_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [schoolId],
  );

  if (existingRules.length === 0) {
    const rules = [
      {
        name: 'IELTS rate for THPT',
        description: 'Đơn giá tiết IELTS cho cấp THPT = 350,000',
        priority: 10,
        conditions: JSON.stringify([
          { field: 'schoolLevel', operator: '==', value: 'THPT' },
        ]),
        action_type: 'set_variable',
        action_target: 'TIEN_IELTS',
        action_value: '350000',
        is_active: true,
      },
      {
        name: 'IELTS rate for THCS',
        description: 'Đơn giá tiết IELTS cho cấp THCS = 300,000',
        priority: 10,
        conditions: JSON.stringify([
          { field: 'schoolLevel', operator: '==', value: 'THCS' },
        ]),
        action_type: 'set_variable',
        action_target: 'TIEN_IELTS',
        action_value: '300000',
        is_active: true,
      },
      {
        name: 'Higher teaching rate for THPT',
        description: 'Đơn giá tiết dạy THPT = 250,000',
        priority: 5,
        conditions: JSON.stringify([
          { field: 'schoolLevel', operator: '==', value: 'THPT' },
        ]),
        action_type: 'set_variable',
        action_target: 'LUONG_TIET_RATE',
        action_value: '250000',
        is_active: true,
      },
    ];

    for (const r of rules) {
      await dataSource.query(
        `INSERT INTO compensation_rules (id, school_id, name, description, priority, conditions, action_type, action_target, action_value, is_active, version)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
         ON CONFLICT DO NOTHING`,
        [schoolId, r.name, r.description, r.priority, r.conditions, r.action_type, r.action_target, r.action_value, r.is_active],
      );
    }
    console.log('  ✅ NBK Rules seeded');
  }

  console.log('✅ NBK Compensation Defaults seed completed');
}
