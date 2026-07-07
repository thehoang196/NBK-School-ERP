-- Seed timetable versions and teaching assignments for NBK-TH school
-- School ID: 4ccf8901-2a99-4bef-8167-66e61d5bf557

DO $$
DECLARE
  v_school_id uuid := '4ccf8901-2a99-4bef-8167-66e61d5bf557';
  v_semester_id uuid;
  v_version_id uuid;
  v_teacher_ids uuid[];
  v_subject_ids uuid[];
  v_class_ids uuid[];
BEGIN
  -- Get semester
  SELECT id INTO v_semester_id FROM semesters WHERE deleted_at IS NULL LIMIT 1;
  IF v_semester_id IS NULL THEN
    RAISE NOTICE 'No semester found, skipping';
    RETURN;
  END IF;

  -- Check if versions already exist
  IF EXISTS (SELECT 1 FROM timetable_versions WHERE school_id = v_school_id AND deleted_at IS NULL) THEN
    RAISE NOTICE 'Timetable versions already exist, skipping';
  ELSE
    -- Create timetable versions
    INSERT INTO timetable_versions (id, school_id, semester_id, name, version_number, status, effective_date, note, has_conflicts, conflict_count, total_slots, created_at, updated_at, version)
    VALUES
      (gen_random_uuid(), v_school_id, v_semester_id, 'TKB HK1 2025-2026 (Nháp)', 1, 'draft', '2025-09-01', 'Bản nháp - đang xếp lịch', false, 0, 0, now(), now(), 1),
      (gen_random_uuid(), v_school_id, v_semester_id, 'TKB HK1 2025-2026 (Chính thức)', 2, 'published', '2025-09-08', 'Đã công bố cho toàn trường', false, 0, 0, now(), now(), 1);
    RAISE NOTICE 'Created 2 timetable versions';
  END IF;

  -- Get draft version for reference
  SELECT id INTO v_version_id FROM timetable_versions WHERE school_id = v_school_id AND status = 'draft' AND deleted_at IS NULL LIMIT 1;

  -- Get arrays of IDs ordered consistently
  SELECT array_agg(id ORDER BY employee_code) INTO v_teacher_ids FROM teachers WHERE school_id = v_school_id AND deleted_at IS NULL;
  SELECT array_agg(id ORDER BY code) INTO v_subject_ids FROM subjects WHERE school_id = v_school_id AND deleted_at IS NULL;
  SELECT array_agg(id ORDER BY name) INTO v_class_ids FROM classes WHERE school_id = v_school_id AND deleted_at IS NULL;

  -- Check if teaching assignments already exist
  IF EXISTS (SELECT 1 FROM teaching_assignments WHERE school_id = v_school_id AND deleted_at IS NULL) THEN
    RAISE NOTICE 'Teaching assignments already exist, skipping';
  ELSE
    -- Create teaching assignments
    -- Subject order by code: AN-NHAC(1), CONG-NGHE(2), DD(3), HDTN(4), KHOA-HOC(5), LS-DL(6), MY-THUAT(7), ROBOTICS(8), TA-TH(9), THE-DUC(10), TIEN-NHAT(11), TIN-HOC(12), TOAN-TH(13), TNXH(14), TV(15)
    -- Teacher order by code: GV001(1)..GV020(20)
    -- Class order by name: 1A1(1), 1A2(2), 1A3(3), 1A4(4), 2A1(5)..5A4(20)

    -- GV001 (Hồng) dạy Toán (idx 13) cho lớp 1A1-1A4
    INSERT INTO teaching_assignments (id, semester_id, teacher_id, class_id, subject_id, school_id, assignment_status, periods_per_week, created_at, updated_at, version) VALUES
      (gen_random_uuid(), v_semester_id, v_teacher_ids[1], v_class_ids[1], v_subject_ids[13], v_school_id, 'active', 5, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[1], v_class_ids[2], v_subject_ids[13], v_school_id, 'active', 5, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[1], v_class_ids[3], v_subject_ids[13], v_school_id, 'active', 5, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[1], v_class_ids[4], v_subject_ids[13], v_school_id, 'active', 5, now(), now(), 1);

    -- GV002 (Minh) dạy Toán (idx 13) cho lớp 2A1-2A4
    INSERT INTO teaching_assignments (id, semester_id, teacher_id, class_id, subject_id, school_id, assignment_status, periods_per_week, created_at, updated_at, version) VALUES
      (gen_random_uuid(), v_semester_id, v_teacher_ids[2], v_class_ids[5], v_subject_ids[13], v_school_id, 'active', 5, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[2], v_class_ids[6], v_subject_ids[13], v_school_id, 'active', 5, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[2], v_class_ids[7], v_subject_ids[13], v_school_id, 'active', 5, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[2], v_class_ids[8], v_subject_ids[13], v_school_id, 'active', 5, now(), now(), 1);

    -- GV003 (Thanh) dạy Tiếng Việt (idx 15) cho lớp 1A1-1A4
    INSERT INTO teaching_assignments (id, semester_id, teacher_id, class_id, subject_id, school_id, assignment_status, periods_per_week, created_at, updated_at, version) VALUES
      (gen_random_uuid(), v_semester_id, v_teacher_ids[3], v_class_ids[1], v_subject_ids[15], v_school_id, 'active', 7, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[3], v_class_ids[2], v_subject_ids[15], v_school_id, 'active', 7, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[3], v_class_ids[3], v_subject_ids[15], v_school_id, 'active', 7, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[3], v_class_ids[4], v_subject_ids[15], v_school_id, 'active', 7, now(), now(), 1);

    -- GV004 (Hải) dạy Tiếng Việt (idx 15) cho lớp 2A1-2A4
    INSERT INTO teaching_assignments (id, semester_id, teacher_id, class_id, subject_id, school_id, assignment_status, periods_per_week, created_at, updated_at, version) VALUES
      (gen_random_uuid(), v_semester_id, v_teacher_ids[4], v_class_ids[5], v_subject_ids[15], v_school_id, 'active', 7, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[4], v_class_ids[6], v_subject_ids[15], v_school_id, 'active', 7, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[4], v_class_ids[7], v_subject_ids[15], v_school_id, 'active', 7, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[4], v_class_ids[8], v_subject_ids[15], v_school_id, 'active', 7, now(), now(), 1);

    -- GV007 (Lan) dạy Tiếng Anh (idx 9) cho lớp 1A1-2A4
    INSERT INTO teaching_assignments (id, semester_id, teacher_id, class_id, subject_id, school_id, assignment_status, periods_per_week, created_at, updated_at, version) VALUES
      (gen_random_uuid(), v_semester_id, v_teacher_ids[7], v_class_ids[1], v_subject_ids[9], v_school_id, 'active', 4, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[7], v_class_ids[2], v_subject_ids[9], v_school_id, 'active', 4, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[7], v_class_ids[3], v_subject_ids[9], v_school_id, 'active', 4, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[7], v_class_ids[4], v_subject_ids[9], v_school_id, 'active', 4, now(), now(), 1);

    -- GV008 (Hùng) dạy Tiếng Anh (idx 9) cho lớp 2A1-2A4
    INSERT INTO teaching_assignments (id, semester_id, teacher_id, class_id, subject_id, school_id, assignment_status, periods_per_week, created_at, updated_at, version) VALUES
      (gen_random_uuid(), v_semester_id, v_teacher_ids[8], v_class_ids[5], v_subject_ids[9], v_school_id, 'active', 4, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[8], v_class_ids[6], v_subject_ids[9], v_school_id, 'active', 4, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[8], v_class_ids[7], v_subject_ids[9], v_school_id, 'active', 4, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[8], v_class_ids[8], v_subject_ids[9], v_school_id, 'active', 4, now(), now(), 1);

    -- GV005 (Mai) dạy Toán cho 3A1-3A4
    INSERT INTO teaching_assignments (id, semester_id, teacher_id, class_id, subject_id, school_id, assignment_status, periods_per_week, created_at, updated_at, version) VALUES
      (gen_random_uuid(), v_semester_id, v_teacher_ids[5], v_class_ids[9], v_subject_ids[13], v_school_id, 'active', 5, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[5], v_class_ids[10], v_subject_ids[13], v_school_id, 'active', 5, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[5], v_class_ids[11], v_subject_ids[13], v_school_id, 'active', 5, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[5], v_class_ids[12], v_subject_ids[13], v_school_id, 'active', 5, now(), now(), 1);

    -- GV011 (Phương) dạy Âm nhạc (idx 1) cho lớp 1A1-3A4
    INSERT INTO teaching_assignments (id, semester_id, teacher_id, class_id, subject_id, school_id, assignment_status, periods_per_week, created_at, updated_at, version) VALUES
      (gen_random_uuid(), v_semester_id, v_teacher_ids[11], v_class_ids[1], v_subject_ids[1], v_school_id, 'active', 1, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[11], v_class_ids[2], v_subject_ids[1], v_school_id, 'active', 1, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[11], v_class_ids[5], v_subject_ids[1], v_school_id, 'active', 1, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[11], v_class_ids[6], v_subject_ids[1], v_school_id, 'active', 1, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[11], v_class_ids[9], v_subject_ids[1], v_school_id, 'active', 1, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[11], v_class_ids[10], v_subject_ids[1], v_school_id, 'active', 1, now(), now(), 1);

    -- GV013 (Ngọc) dạy Thể dục (idx 10) cho lớp 1A1-2A4
    INSERT INTO teaching_assignments (id, semester_id, teacher_id, class_id, subject_id, school_id, assignment_status, periods_per_week, created_at, updated_at, version) VALUES
      (gen_random_uuid(), v_semester_id, v_teacher_ids[13], v_class_ids[1], v_subject_ids[10], v_school_id, 'active', 2, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[13], v_class_ids[2], v_subject_ids[10], v_school_id, 'active', 2, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[13], v_class_ids[3], v_subject_ids[10], v_school_id, 'active', 2, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[13], v_class_ids[4], v_subject_ids[10], v_school_id, 'active', 2, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[13], v_class_ids[5], v_subject_ids[10], v_school_id, 'active', 2, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[13], v_class_ids[6], v_subject_ids[10], v_school_id, 'active', 2, now(), now(), 1);

    -- GV009 (Hạnh) dạy Tin học (idx 12) cho lớp 1A1-3A4
    INSERT INTO teaching_assignments (id, semester_id, teacher_id, class_id, subject_id, school_id, assignment_status, periods_per_week, created_at, updated_at, version) VALUES
      (gen_random_uuid(), v_semester_id, v_teacher_ids[9], v_class_ids[1], v_subject_ids[12], v_school_id, 'active', 1, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[9], v_class_ids[2], v_subject_ids[12], v_school_id, 'active', 1, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[9], v_class_ids[5], v_subject_ids[12], v_school_id, 'active', 1, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[9], v_class_ids[6], v_subject_ids[12], v_school_id, 'active', 1, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[9], v_class_ids[9], v_subject_ids[12], v_school_id, 'active', 1, now(), now(), 1),
      (gen_random_uuid(), v_semester_id, v_teacher_ids[9], v_class_ids[10], v_subject_ids[12], v_school_id, 'active', 1, now(), now(), 1);

    RAISE NOTICE 'Created teaching assignments';
  END IF;
END $$;
