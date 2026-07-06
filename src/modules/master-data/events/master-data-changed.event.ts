export class MasterDataChangedEventPayload {
  schoolId: string;
  employeeCode: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  timestamp: Date;
}
