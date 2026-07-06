export interface MasterDataChangedEvent {
  schoolId: string;
  employeeCode: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  timestamp: Date;
}

export interface ModuleDataChangedEvent {
  sourceModule: string;
  schoolId: string;
  employeeCode: string;
  fieldName: string;
  newValue: string | null;
  timestamp: Date;
}
