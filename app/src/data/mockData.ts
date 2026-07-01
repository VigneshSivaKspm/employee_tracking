import type { User, AttendanceRecord, LeaveRequest, Announcement, LeaveBalance, MonthlyAnalytics } from '../types';

export const MOCK_USER: User = {
  id: 'usr_001',
  name: 'Vignesh Kumar',
  email: 'vignesh.kumar@worktrack.com',
  employeeId: 'EMP-2024-0047',
  designation: 'Senior Software Engineer',
  department: 'Technology & Innovation',
  phone: '+91 98765 43210',
  emergencyContact: 'Priya Kumar (Spouse)',
  emergencyPhone: '+91 91234 56789',
  joinDate: '2022-03-15',
};

export const MOCK_CREDENTIALS = {
  email: 'vignesh.kumar@worktrack.com',
  password: 'password123',
  employeeId: 'EMP-2024-0047',
};

export const MOCK_ATTENDANCE: AttendanceRecord[] = [
  { id: 'att_001', date: '2026-06-25', clockIn: '09:02', clockOut: null, status: 'on_time', totalHours: 0, isRemote: false },
  { id: 'att_002', date: '2026-06-24', clockIn: '09:05', clockOut: '18:03', status: 'on_time', totalHours: 8.97, isRemote: false },
  { id: 'att_003', date: '2026-06-23', clockIn: '09:47', clockOut: '18:30', status: 'late', totalHours: 8.72, isRemote: true },
  { id: 'att_004', date: '2026-06-20', clockIn: '08:55', clockOut: '18:00', status: 'on_time', totalHours: 9.08, isRemote: false },
  { id: 'att_005', date: '2026-06-19', clockIn: '09:12', clockOut: '18:15', status: 'on_time', totalHours: 9.05, isRemote: false },
  { id: 'att_006', date: '2026-06-18', clockIn: '10:05', clockOut: '18:00', status: 'late', totalHours: 7.92, isRemote: true },
  { id: 'att_007', date: '2026-06-17', clockIn: null, clockOut: null, status: 'absent', totalHours: 0, isRemote: false },
  { id: 'att_008', date: '2026-06-16', clockIn: '09:00', clockOut: '13:00', status: 'half_day', totalHours: 4.0, isRemote: false },
  { id: 'att_009', date: '2026-06-13', clockIn: '08:58', clockOut: '18:02', status: 'on_time', totalHours: 9.07, isRemote: false },
  { id: 'att_010', date: '2026-06-12', clockIn: '09:03', clockOut: '17:55', status: 'on_time', totalHours: 8.87, isRemote: false },
  { id: 'att_011', date: '2026-06-11', clockIn: '09:25', clockOut: '18:10', status: 'late', totalHours: 8.75, isRemote: true },
  { id: 'att_012', date: '2026-06-10', clockIn: '09:01', clockOut: '18:00', status: 'on_time', totalHours: 8.98, isRemote: false },
];

export const MOCK_LEAVES: LeaveRequest[] = [
  {
    id: 'leave_001',
    type: 'annual',
    startDate: '2026-06-17',
    endDate: '2026-06-17',
    reason: 'Family function – annual gathering',
    status: 'approved',
    appliedOn: '2026-06-10',
    hasDocument: false,
    totalDays: 1,
  },
  {
    id: 'leave_002',
    type: 'sick',
    startDate: '2026-07-04',
    endDate: '2026-07-05',
    reason: 'Doctor appointment and recovery',
    status: 'pending',
    appliedOn: '2026-06-25',
    hasDocument: true,
    totalDays: 2,
  },
  {
    id: 'leave_003',
    type: 'personal',
    startDate: '2026-05-12',
    endDate: '2026-05-13',
    reason: 'Personal work',
    status: 'rejected',
    appliedOn: '2026-05-08',
    hasDocument: false,
    totalDays: 2,
  },
  {
    id: 'leave_004',
    type: 'annual',
    startDate: '2026-04-14',
    endDate: '2026-04-16',
    reason: 'Vacation – family trip to Ooty',
    status: 'approved',
    appliedOn: '2026-04-05',
    hasDocument: false,
    totalDays: 3,
  },
];

export const MOCK_LEAVE_BALANCE: LeaveBalance = {
  casual: 5,
  sick: 3,
  earned: 7,
  entitled: 24,
  taken: 6,
  pending: 2,
  remaining: 16,
};

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann_001',
    title: 'Q2 Performance Reviews – Schedule Released',
    snippet: 'The Q2 performance review schedule is now live. All team leads should book slots with their respective team members by July 5th.',
    date: '2026-06-24',
    category: 'HR',
    isNew: true,
  },
  {
    id: 'ann_002',
    title: 'New Work-From-Home Policy Effective July 1',
    snippet: 'Following the updated hybrid working guidelines, employees may now work remotely for up to 3 days per week. Updated policy document attached.',
    date: '2026-06-22',
    category: 'Policy',
    isNew: true,
  },
  {
    id: 'ann_003',
    title: 'Office Closure – June 27 (Company Day)',
    snippet: 'The office will remain closed on June 27th for the annual company foundation day. Enjoy the long weekend!',
    date: '2026-06-20',
    category: 'Holiday',
    isNew: false,
  },
  {
    id: 'ann_004',
    title: 'Employee of the Month – May 2026',
    snippet: 'Congratulations to Arjun Sharma from the Product team for being awarded Employee of the Month for May 2026. Outstanding achievement!',
    date: '2026-06-15',
    category: 'Recognition',
    isNew: false,
  },
];

export const MOCK_ANALYTICS: MonthlyAnalytics = {
  presentDays: 20,
  leaveDays: 3,
  absentDays: 1,
  totalWorkingHours: 179.4,
  attendancePercentage: 91.7,
  avgClockIn: '09:08',
  avgClockOut: '18:04',
  month: 'June 2026',
};
