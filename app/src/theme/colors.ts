export const Colors = {
  // Primary brand
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryDeep: '#1E40AF',
  primaryLight: '#EFF6FF',
  primaryMid: '#DBEAFE',
  primaryBorder: '#BFDBFE',

  // Page & surface
  pageBg: '#F1F5F9',
  white: '#FFFFFF',
  card: '#FFFFFF',
  inputBg: '#F8FAFC',
  overlay: 'rgba(0,0,0,0.5)',

  // Legacy compat — keeps older screens building
  bg: {
    primary: '#F1F5F9',
    secondary: '#FFFFFF',
    card: '#FFFFFF',
    cardElevated: '#F8FAFC',
    overlay: 'rgba(0,0,0,0.5)',
  },

  // Text
  text: {
    primary: '#1E293B',
    secondary: '#64748B',
    muted: '#94A3B8',
    placeholder: '#CBD5E1',
    white: '#FFFFFF',
    accent: '#2563EB',
  },

  // Semantic
  success: '#16A34A',
  successDark: '#15803D',
  successLight: '#DCFCE7',
  successBorder: '#86EFAC',

  warning: '#D97706',
  warningLight: '#FEF3C7',
  warningBorder: '#FCD34D',

  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  dangerBorder: '#FCA5A5',

  purple: '#7C3AED',
  purpleLight: '#EDE9FE',
  purpleBorder: '#C4B5FD',

  orange: '#EA580C',
  orangeLight: '#FFF7ED',

  // Borders & dividers
  borderColor: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderFocus: '#2563EB',
  border: {
    default: '#E2E8F0',
    active: '#2563EB',
    focus: '#2563EB',
  },

  // Status badges
  badge: {
    onTime: { bg: '#DCFCE7', text: '#16A34A', border: '#86EFAC' },
    late: { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D' },
    absent: { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' },
    halfDay: { bg: '#EDE9FE', text: '#7C3AED', border: '#C4B5FD' },
    approved: { bg: '#DCFCE7', text: '#16A34A', border: '#86EFAC' },
    pending: { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D' },
    rejected: { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' },
    present: { bg: '#DCFCE7', text: '#16A34A', border: '#86EFAC' },
  },

  // Gradients
  gradient: {
    primary: ['#2563EB', '#1D4ED8'] as string[],
    primaryDeep: ['#1D4ED8', '#1E40AF'] as string[],
    success: ['#16A34A', '#15803D'] as string[],
    danger: ['#DC2626', '#B91C1C'] as string[],
    header: ['#2563EB', '#1D4ED8'] as string[],
    punchIn: ['#16A34A', '#15803D'] as string[],
    punchOut: ['#DC2626', '#B91C1C'] as string[],
    working: ['#16A34A', '#15803D'] as string[],
  },

  // Legacy compat (keep for components not yet migrated)
  accent: {
    primary: '#2563EB',
    primaryLight: '#60A5FA',
    primaryMuted: '#EFF6FF',
    success: '#16A34A',
    successMuted: '#DCFCE7',
    warning: '#D97706',
    warningMuted: '#FEF3C7',
    danger: '#DC2626',
    dangerMuted: '#FEE2E2',
    purple: '#7C3AED',
    purpleMuted: '#EDE9FE',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  full: 9999,
};

export const Typography = {
  xs: { fontSize: 11, lineHeight: 16 },
  sm: { fontSize: 13, lineHeight: 18 },
  base: { fontSize: 15, lineHeight: 22 },
  md: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 26 },
  xl: { fontSize: 22, lineHeight: 30 },
  xxl: { fontSize: 28, lineHeight: 36 },
  display: { fontSize: 36, lineHeight: 44 },
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  blue: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
};
