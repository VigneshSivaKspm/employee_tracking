import type { NavigatorScreenParams } from '@react-navigation/native';

export type AttendanceStatus = 'not_clocked_in' | 'active' | 'clocked_out';
export type LeaveStatus = 'approved' | 'pending' | 'rejected';
export type PunchStatus = 'on_time' | 'late' | 'absent' | 'half_day';
export type LeaveType = 'casual' | 'sick' | 'earned' | 'maternity' | 'paternity' | 'unpaid' | 'annual' | 'personal';
export type SubscriptionPlan = 'basic' | 'premium';
export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

export type UserRole = 'employee' | 'branch_admin' | 'super_admin';

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
  branchName?: string;
  branchId?: string;
  companyName?: string;
  status?: string;
  role?: UserRole;
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
  documentName?: string;
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

export interface TargetComment {
  id: string;
  text: string;
  authorName: string;
  authorId: string;
  role?: 'employee' | 'admin';
  createdAt: string;
}

export type TargetType = 'task' | 'multiple';
export type TargetStatus = 'Active' | 'Completed' | 'Overdue' | 'Draft';

export interface EmployeeTarget {
  id: string;
  title: string;
  description?: string;
  type?: TargetType;
  targetValue: number;
  achievedValue: number;
  unit?: string;
  startDate: string;
  endDate: string;
  status: TargetStatus;
  department?: string;
  employeeId?: string;
  employeeName?: string;
  userId?: string;
  comments?: TargetComment[];
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
export type SignUpData = {
  fullName: string;
  employeeId: string;
  email: string;
  phone: string;
  password: string;
};

export type AuthStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  SignUp: undefined;
  OTPVerification: { phone: string; type: 'signup' | 'forgot' };
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  Permissions: { signUpData?: SignUpData } | undefined;
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
  Permissions: { signUpData?: SignUpData } | undefined;

  // App screens
  Main: NavigatorScreenParams<BottomTabParamList> | undefined;
  Attendance: undefined;
  Leave: undefined;
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
  LeaveDetail: { leaveId: string };
  ServiceRequests: undefined;
  Calendar: undefined;
  Sales: undefined;
  Analytics: undefined;
  AudioRecordings: undefined;
  ChatConversation: { chatId: string; otherUserId: string; otherUserName: string };
  StorageSync: undefined;
  FileManager: undefined;
};

export type BottomTabParamList = {
  Dashboard: undefined;
  Chat: undefined;
  Calls: undefined;
  Tasks: undefined;
  Sales: undefined;
  Profile: undefined;
};
