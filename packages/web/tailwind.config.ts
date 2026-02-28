import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        line: { DEFAULT: '#06C755', dark: '#05a847', light: '#4cd880' },
      },
    },
  },
  plugins: [],
};

export default config;
