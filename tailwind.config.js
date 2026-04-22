/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        subject: {
          chinese: '#D14343',
          'chinese-bg': '#FBEBEB',
          'chinese-bubble': '#F6DADA',
          math: '#3B6EA8',
          'math-bg': '#E7EEF6',
          'math-bubble': '#D5E2EF',
          english: '#3B8A7C',
          'english-bg': '#E6F1EE',
          'english-bubble': '#D2E4E0',
        },
        page: '#FAFAF8',
        card: '#FFFFFF',
        ink: {
          DEFAULT: '#1A1A1A',
          sub: '#666666',
        },
        line: {
          DEFAULT: '#E5E3DD',
          soft: '#EFEDE7',
        },
        warn: {
          DEFAULT: '#C6651E',
          bg: '#FFF3E8',
        },
        'neutral-chip': '#F3F1EB',
      },
      fontFamily: {
        sans: [
          'Inter',
          '"Noto Sans TC"',
          '"PingFang TC"',
          '"PingFang SC"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Helvetica Neue"',
          'sans-serif',
        ],
      },
      fontSize: {
        'student-base': ['17px', { lineHeight: '1.5' }],
        'teacher-base': ['15px', { lineHeight: '1.5' }],
      },
      borderRadius: {
        card: '16px',
        btn: '12px',
        option: '16px',
        chip: '8px',
        bubble: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,20,20,0.04)',
      },
      minHeight: {
        'btn-student': '56px',
        'btn-teacher': '40px',
        'btn-option': '64px',
        'btn-icon': '36px',
      },
      maxWidth: {
        teacher: '1200px',
      },
      transitionDuration: {
        btn: '150ms',
        bar: '500ms',
        ring: '600ms',
      },
    },
  },
  plugins: [],
}
