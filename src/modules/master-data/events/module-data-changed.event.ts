export class ModuleDataChangedEventPayload {
  sourceModule: string;
  schoolId: string;
  employeeCode: string;
  fieldName: string;
  newValue: string | null;
  timestamp: Date;
}
