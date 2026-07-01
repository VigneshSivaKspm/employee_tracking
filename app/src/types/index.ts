export type AttendanceStatus = 'not_clocked_in' | 'active' | 'clocked_out';
export type LeaveStatus = 'approved' | 'pending' | 'rejected';
export type PunchStatus = 'on_time' | 'late' | 'absent' | 'half_day';
export type LeaveType = 'casual' | 'sick' | 'earned' | 'maternity' | 'paternity' | 'unpaid' | 'annual' | 'personal';
export type SubscriptionPlan = 'basic' | 'premium';
export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

export interface User {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  designation: string;
  department: string;
  avatarUrl?: string;
  phone: string;
  emergencyContact: string;
  emergencyPhone: string;
  joinDate: string;
  bankAccount?: string;
  bankName?: string;
  ifscCode?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: PunchStatus;
  totalHours: number;
  isRemote: boolean;
}

export interface LeaveRequest {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  hasDocument: boolean;
  totalDays: number;
}

export interface Announcement {
  id: string;
  title: string;
  snippet: string;
  body?: string;
  date: string;
  category: string;
  isNew: boolean;
  imageUrl?: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  type: 'leave' | 'announcement' | 'salary' | 'attendance' | 'general';
  isRead: boolean;
}

export interface LeaveBalance {
  casual: number;
  sick: number;
  earned: number;
  entitled: number;
  taken: number;
  pending: number;
  remaining: number;
}

export interface MonthlyAnalytics {
  presentDays: number;
  leaveDays: number;
  absentDays: number;
  totalWorkingHours: number;
  attendancePercentage: number;
  avgClockIn: string;
  avgClockOut: string;
  month: string;
}

// Navigation param lists
export type AuthStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  SignUp: undefined;
  OTPVerification: { phone: string; type: 'signup' | 'forgot' };
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  Permissions: undefined;
};

export type RootStackParamList = {
  // Auth screens
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  SignUp: undefined;
  OTPVerification: { phone: string; type: 'signup' | 'forgot' };
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  Permissions: undefined;

  // App screens
  Main: undefined;
  ApplyLeave: undefined;
  LeaveHistory: undefined;
  AttendanceHistory: undefined;
  AnnouncementDetail: { announcementId: string };
  EditProfile: undefined;
  ChangePassword: undefined;
  Notifications: undefined;
  Settings: undefined;
  SubscriptionPlans: undefined;
  PaymentMethod: { planId: string; planName: string; price: number };
  PaymentGateway: { method: PaymentMethod; planName: string; price: number };
  PaymentSuccess: { planName: string; price: number; transactionId: string };
  EngineeringMenu: undefined;
  LeaveDetail: { leaveId: string };
};

export type BottomTabParamList = {
  Dashboard: undefined;
  Attendance: undefined;
  Leave: undefined;
  Analytics: undefined;
  Profile: undefined;
};
