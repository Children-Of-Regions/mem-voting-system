/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // MEM Design System Colors
      colors: {
        // Brand Colors (Greens)
        brand: {
          50: '#E1F4E2',
          100: '#BFE3C2',
          200: '#9DD2A2',
          300: '#ECFFED',
          400: '#59B061',
          500: '#379F41', // Main
          600: '#2C7F34',
          700: '#215F27',
        },
        // Accent Colors
        accent: {
          blue: {
            dark: '#4F01A3',
            light: '#F7EFFF',
          },
          purple: {
            dark: '#A14BED',
            light: '#F7F6FF',
          },
          coral: {
            dark: '#FC635C',
            light: '#FFE7E5',
          },
          yellow: {
            dark: '#E9C501',
            light: '#FFFDF2',
          },
        },
        // Neutral / Grayscale (Fade)
        fade: {
          black: '#000000',
          800: '#333333',
          750: '#404040',
          700: '#4D4D4D',
          600: '#666666',
          500: '#808080',
          400: '#999999',
          250: '#BFBFBF',
          200: '#CCCCCC',
          20: '#CCCCCC',
          100: '#E5E5E5',
          50: '#F2F2F2',
          white: '#FFFFFF',
        },
        // Functional Colors
        error: {
          dark: '#EA2E36',
          light: '#F26C72',
        },
        helping: {
          5: '#F7FBF5',
          150: '#CEE4C0',
          300: '#A5CC8B',
        },
        // Detail Colors
        details: {
          yellow: '#FFFBE4',
          green1: '#E2E9D0',
          green2: '#BEDA78',
          orange: '#F99375',
          green3: '#79D997',
          blue: '#C4D8FF',
          yellow2: '#FFE13C',
        },
      },
      // MEM Breakpoints
      screens: {
        'xs': '376px',
        'sm': '540px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1200px',
        'xsl': '1320px',
        'xxl': '1440px',
      },
      // Typography
      fontFamily: {
        'montserrat': ['MontserratArm', 'Montserrat', 'Inter', 'sans-serif'],
      },
      fontSize: {
        'h3': '40px',
        'h5': '22px',
        'h6': '18px',
      },
      fontWeight: {
        'regular': '400',
        'medium': '500',
        'bold': '700',
        'extrabold': '900',
      },
      // Shadows from MEM Design
      boxShadow: {
        'header': '0px 2px 10px -2px rgba(16, 24, 40, 0.06)',
        'input': '0px 1px 2px 0px rgba(16, 24, 40, 0.05)',
        'input-focus': '0px 0px 0px 4px #F7FBF5',
        'input-error': '0px 0px 0px 4px #FFEBE9',
      },
      borderRadius: {
        'pill': '100px',
      },
    },
  },
  plugins: [],
}
