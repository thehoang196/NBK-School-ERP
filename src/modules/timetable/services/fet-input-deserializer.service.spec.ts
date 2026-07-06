import { FetInputDeserializerService } from './fet-input-deserializer.service';
import { FetParseException } from '../exceptions/fet-parse.exception';

describe('FetInputDeserializerService', () => {
  let service: FetInputDeserializerService;

  beforeEach(() => {
    service = new FetInputDeserializerService();
  });

  describe('deserialize', () => {
    const validXml = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="6.2.7">
  <Institution_Name>NBK School</Institution_Name>
  <Comments>schoolId: school-001; semesterId: sem-001</Comments>
  <Days_List>
    <Number_of_Days>6</Number_of_Days>
    <Day><Name>Thứ 2</Name></Day>
    <Day><Name>Thứ 3</Name></Day>
    <Day><Name>Thứ 4</Name></Day>
    <Day><Name>Thứ 5</Name></Day>
    <Day><Name>Thứ 6</Name></Day>
    <Day><Name>Thứ 7</Name></Day>
  </Days_List>
  <Hours_List>
    <Number_of_Hours>5</Number_of_Hours>
    <Hour><Name>Tiết 1</Name></Hour>
    <Hour><Name>Tiết 2</Name></Hour>
    <Hour><Name>Tiết 3</Name></Hour>
    <Hour><Name>Tiết 4</Name></Hour>
    <Hour><Name>Tiết 5</Name></Hour>
  </Hours_List>
  <Teachers_List>
    <Teacher><Name>Nguyen Van A</Name></Teacher>
    <Teacher><Name>Tran Thi B</Name></Teacher>
  </Teachers_List>
  <Subjects_List>
    <Subject><Name>Toán</Name></Subject>
    <Subject><Name>Văn</Name></Subject>
  </Subjects_List>
  <Students_List>
    <Year>
      <Name>grade-10</Name>
      <Group><Name>10A1</Name></Group>
      <Group><Name>10A2</Name></Group>
    </Year>
  </Students_List>
  <Activities_List>
    <Activity>
      <Id>1</Id>
      <Teacher>Nguyen Van A</Teacher>
      <Subject>Toán</Subject>
      <Students>10A1</Students>
      <Duration>1</Duration>
      <Total_Duration>4</Total_Duration>
      <Active>true</Active>
    </Activity>
    <Activity>
      <Id>2</Id>
      <Teacher>Tran Thi B</Teacher>
      <Subject>Văn</Subject>
      <Students>10A2</Students>
      <Duration>1</Duration>
      <Total_Duration>3</Total_Duration>
      <Active>true</Active>
    </Activity>
  </Activities_List>
  <Rooms_List>
    <Room><Name>Phòng 101</Name><Capacity>40</Capacity></Room>
    <Room><Name>Phòng 102</Name><Capacity>35</Capacity></Room>
  </Rooms_List>
  <Time_Constraints_List>
    <ConstraintTeacherNotAvailableTimes>
      <Weight_Percentage>100</Weight_Percentage>
      <Teacher>Nguyen Van A</Teacher>
      <Number_of_Not_Available_Times>2</Number_of_Not_Available_Times>
      <Not_Available_Time>
        <Day>Thứ 2</Day>
        <Hour>Tiết 1</Hour>
      </Not_Available_Time>
      <Not_Available_Time>
        <Day>Thứ 3</Day>
        <Hour>Tiết 2</Hour>
      </Not_Available_Time>
    </ConstraintTeacherNotAvailableTimes>
    <ConstraintTeacherMaxHoursDaily>
      <Weight_Percentage>100</Weight_Percentage>
      <Teacher>Nguyen Van A</Teacher>
      <Maximum_Hours_Daily>6</Maximum_Hours_Daily>
    </ConstraintTeacherMaxHoursDaily>
    <ConstraintTeacherMaxHoursDaily>
      <Weight_Percentage>100</Weight_Percentage>
      <Teacher>Tran Thi B</Teacher>
      <Maximum_Hours_Daily>5</Maximum_Hours_Daily>
    </ConstraintTeacherMaxHoursDaily>
  </Time_Constraints_List>
  <Space_Constraints_List>
    <ConstraintActivityPreferredRoom>
      <Weight_Percentage>100</Weight_Percentage>
      <Activity_Id>1</Activity_Id>
      <Room>Phòng 101</Room>
    </ConstraintActivityPreferredRoom>
  </Space_Constraints_List>
</fet>`;

    it('should parse a valid FET XML and return FetInputData', () => {
      const result = service.deserialize(validXml);

      expect(result.institution).toBe('NBK School');
      expect(result.schoolId).toBe('school-001');
      expect(result.semesterId).toBe('sem-001');
    });

    it('should parse days correctly', () => {
      const result = service.deserialize(validXml);

      expect(result.days).toHaveLength(6);
      expect(result.days[0]).toBe('Thứ 2');
      expect(result.days[5]).toBe('Thứ 7');
    });

    it('should parse period definitions from hours', () => {
      const result = service.deserialize(validXml);

      expect(result.periodDefinitions).toHaveLength(5);
      expect(result.periodDefinitions[0].name).toBe('Tiết 1');
      expect(result.periodDefinitions[0].periodNumber).toBe(1);
      expect(result.periodDefinitions[4].name).toBe('Tiết 5');
      expect(result.periodDefinitions[4].periodNumber).toBe(5);
    });

    it('should parse teachers with maxPeriodsPerDay from constraints', () => {
      const result = service.deserialize(validXml);

      expect(result.teachers).toHaveLength(2);
      expect(result.teachers[0].name).toBe('Nguyen Van A');
      expect(result.teachers[0].maxPeriodsPerDay).toBe(6);
      expect(result.teachers[1].name).toBe('Tran Thi B');
      expect(result.teachers[1].maxPeriodsPerDay).toBe(5);
    });

    it('should parse subjects correctly', () => {
      const result = service.deserialize(validXml);

      expect(result.subjects).toHaveLength(2);
      expect(result.subjects[0].name).toBe('Toán');
      expect(result.subjects[1].name).toBe('Văn');
    });

    it('should parse classes from students list (year/group structure)', () => {
      const result = service.deserialize(validXml);

      expect(result.classes).toHaveLength(2);
      expect(result.classes[0].name).toBe('10A1');
      expect(result.classes[0].gradeId).toBe('grade-10');
      expect(result.classes[1].name).toBe('10A2');
      expect(result.classes[1].gradeId).toBe('grade-10');
    });

    it('should parse rooms with capacity', () => {
      const result = service.deserialize(validXml);

      expect(result.rooms).toHaveLength(2);
      expect(result.rooms[0].name).toBe('Phòng 101');
      expect(result.rooms[0].capacity).toBe(40);
      expect(result.rooms[1].name).toBe('Phòng 102');
      expect(result.rooms[1].capacity).toBe(35);
    });

    it('should aggregate activities into teaching assignments by teacher+class+subject', () => {
      const result = service.deserialize(validXml);

      expect(result.teachingAssignments).toHaveLength(2);

      // Activity 1: Teacher=Nguyen Van A, Toán, 10A1, Total_Duration=4
      const assignment1 = result.teachingAssignments.find(
        (a) =>
          a.teacherId === result.teachers[0].id &&
          a.classId === result.classes[0].id,
      );
      expect(assignment1).toBeDefined();
      expect(assignment1!.periodsPerWeek).toBe(4);

      // Activity 2: Teacher=Tran Thi B, Văn, 10A2, Total_Duration=3
      const assignment2 = result.teachingAssignments.find(
        (a) =>
          a.teacherId === result.teachers[1].id &&
          a.classId === result.classes[1].id,
      );
      expect(assignment2).toBeDefined();
      expect(assignment2!.periodsPerWeek).toBe(3);
    });

    it('should parse teacher availability constraints', () => {
      const result = service.deserialize(validXml);

      expect(result.teacherAvailability).toHaveLength(1);
      const availability = result.teacherAvailability[0];
      expect(availability.teacherId).toBe(result.teachers[0].id);
      expect(availability.unavailableSlots).toHaveLength(2);
      expect(availability.unavailableSlots[0].dayOfWeek).toBe(0); // Thứ 2 = index 0
      expect(availability.unavailableSlots[0].periodId).toBe(
        result.periodDefinitions[0].id,
      );
      expect(availability.unavailableSlots[1].dayOfWeek).toBe(1); // Thứ 3 = index 1
      expect(availability.unavailableSlots[1].periodId).toBe(
        result.periodDefinitions[1].id,
      );
    });

    it('should parse room constraints from space constraints', () => {
      const result = service.deserialize(validXml);

      expect(result.roomConstraints).toHaveLength(1);
      expect(result.roomConstraints[0].roomId).toBe(result.rooms[0].id);
      expect(result.roomConstraints[0].weight).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('should throw FetParseException on empty string', () => {
      expect(() => service.deserialize('')).toThrow(FetParseException);
    });

    it('should throw FetParseException on whitespace-only input', () => {
      expect(() => service.deserialize('   ')).toThrow(FetParseException);
    });

    it('should throw FetParseException when <fet> root element is missing', () => {
      const xml = `<?xml version="1.0"?><root><data>hello</data></root>`;
      expect(() => service.deserialize(xml)).toThrow(FetParseException);
      expect(() => service.deserialize(xml)).toThrow('Thiếu phần tử gốc <fet>');
    });

    it('should handle empty lists gracefully', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="6.2.7">
  <Institution_Name>Empty School</Institution_Name>
  <Days_List><Number_of_Days>0</Number_of_Days></Days_List>
  <Hours_List><Number_of_Hours>0</Number_of_Hours></Hours_List>
  <Teachers_List></Teachers_List>
  <Subjects_List></Subjects_List>
  <Students_List></Students_List>
  <Activities_List></Activities_List>
  <Rooms_List></Rooms_List>
  <Time_Constraints_List></Time_Constraints_List>
  <Space_Constraints_List></Space_Constraints_List>
</fet>`;
      const result = service.deserialize(xml);

      expect(result.institution).toBe('Empty School');
      expect(result.days).toHaveLength(0);
      expect(result.periodDefinitions).toHaveLength(0);
      expect(result.teachers).toHaveLength(0);
      expect(result.subjects).toHaveLength(0);
      expect(result.classes).toHaveLength(0);
      expect(result.rooms).toHaveLength(0);
      expect(result.teachingAssignments).toHaveLength(0);
      expect(result.teacherAvailability).toHaveLength(0);
      expect(result.roomConstraints).toHaveLength(0);
    });

    it('should handle missing optional elements (no constraints)', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="6.2.7">
  <Institution_Name>Basic School</Institution_Name>
  <Days_List>
    <Number_of_Days>1</Number_of_Days>
    <Day><Name>Monday</Name></Day>
  </Days_List>
  <Hours_List>
    <Number_of_Hours>1</Number_of_Hours>
    <Hour><Name>Period 1</Name></Hour>
  </Hours_List>
  <Teachers_List>
    <Teacher><Name>Teacher A</Name></Teacher>
  </Teachers_List>
  <Subjects_List>
    <Subject><Name>Math</Name></Subject>
  </Subjects_List>
  <Students_List>
    <Year>
      <Name>grade-1</Name>
      <Group><Name>Class 1A</Name></Group>
    </Year>
  </Students_List>
  <Activities_List>
    <Activity>
      <Id>1</Id>
      <Teacher>Teacher A</Teacher>
      <Subject>Math</Subject>
      <Students>Class 1A</Students>
      <Duration>1</Duration>
      <Total_Duration>1</Total_Duration>
      <Active>true</Active>
    </Activity>
  </Activities_List>
  <Rooms_List>
    <Room><Name>Room 1</Name><Capacity>30</Capacity></Room>
  </Rooms_List>
</fet>`;
      const result = service.deserialize(xml);

      expect(result.teachers).toHaveLength(1);
      expect(result.teachers[0].maxPeriodsPerDay).toBe(0); // No max hours constraint
      expect(result.teacherAvailability).toHaveLength(0);
      expect(result.roomConstraints).toHaveLength(0);
    });

    it('should handle malformed XML', () => {
      const xml = `<?xml version="1.0"?><fet><unclosed`;
      expect(() => service.deserialize(xml)).toThrow(FetParseException);
    });

    it('should handle Comments without schoolId/semesterId', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="6.2.7">
  <Institution_Name>School</Institution_Name>
  <Comments>Generated by FET</Comments>
  <Days_List><Number_of_Days>0</Number_of_Days></Days_List>
  <Hours_List><Number_of_Hours>0</Number_of_Hours></Hours_List>
</fet>`;
      const result = service.deserialize(xml);

      expect(result.schoolId).toBe('');
      expect(result.semesterId).toBe('');
    });

    it('should skip activities with unknown teacher/class/subject references', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fet version="6.2.7">
  <Institution_Name>School</Institution_Name>
  <Teachers_List>
    <Teacher><Name>Known Teacher</Name></Teacher>
  </Teachers_List>
  <Subjects_List>
    <Subject><Name>Known Subject</Name></Subject>
  </Subjects_List>
  <Students_List>
    <Year>
      <Name>grade-1</Name>
      <Group><Name>Known Class</Name></Group>
    </Year>
  </Students_List>
  <Activities_List>
    <Activity>
      <Id>1</Id>
      <Teacher>Unknown Teacher</Teacher>
      <Subject>Known Subject</Subject>
      <Students>Known Class</Students>
      <Duration>1</Duration>
      <Total_Duration>1</Total_Duration>
      <Active>true</Active>
    </Activity>
    <Activity>
      <Id>2</Id>
      <Teacher>Known Teacher</Teacher>
      <Subject>Known Subject</Subject>
      <Students>Known Class</Students>
      <Duration>1</Duration>
      <Total_Duration>1</Total_Duration>
      <Active>true</Active>
    </Activity>
  </Activities_List>
  <Rooms_List></Rooms_List>
</fet>`;
      const result = service.deserialize(xml);

      // Only the activity with valid references should be included
      expect(result.teachingAssignments).toHaveLength(1);
      expect(result.teachingAssignments[0].periodsPerWeek).toBe(1);
    });
  });
});
