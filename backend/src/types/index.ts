export interface IBranch {
  id?: number;
  code: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEmployee {
  id: number;
  personId: string | null;
  fullName: string;
  telegramUserId: string | null;
  phone?: string | null;
  branchId: number | null;
  isActive: boolean;
  language?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAttendance {
  id?: number;
  employeeId: number;
  date: string;
  checkIn: Date | null;
  checkOut: Date | null;
  wasPresent: boolean;
  isLate: boolean;
  expectedStartTime: string;
  locationCode: string | null;
  personId: string | null;
  attendanceStatus?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IExcuse {
  id?: number;
  employeeId: number;
  date: string;
  type: "late" | "sick" | "dayoff";
  minutes?: number | null;
  reason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
