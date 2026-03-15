export const colors = {
  // Brand
  navy:        '#0D2B55',
  navyMid:     '#1A3F73',
  navyLight:   '#E8EEF7',
  green:       '#2D8A4E',
  greenLight:  '#E6F4EB',
  greenMid:    '#3DAA62',

  // Semantic
  danger:      '#C0392B',
  dangerLight: '#FDECEA',
  warning:     '#B45309',
  warningLight:'#FEF3C7',

  // Neutral
  white:       '#FFFFFF',
  surface:     '#F7F9FC',
  border:      'rgba(13,43,85,0.12)',
  textPrimary: '#0D2B55',
  textMuted:   '#6B7A99',
  textLight:   '#9AA5BE',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const fontSize = {
  xs:   11,
  sm:   12,
  md:   14,
  base: 16,
  lg:   18,
  xl:   20,
  xxl:  24,
  xxxl: 28,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium:  '500' as const,
  semibold:'600' as const,
  bold:    '700' as const,
};
