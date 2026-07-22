import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // 编辑纸感：中文用 LXGW WenKai 霞鹜文楷，英文标题用 Fraunces 衬线
        sans: ['"LXGW WenKai"', '"Fraunces"', 'system-ui', 'sans-serif'],
        serif: ['"Fraunces"', '"LXGW WenKai"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // catppuccin Latte（浅色 only）—— 见 https://catppuccin.com/palette
        base: '#EFF1F5',
        mantle: '#E6E9EF',
        crust: '#DCE0E8',
        surface0: '#CCD0DA',
        surface1: '#BCC0CC',
        surface2: '#ACB0BE',
        ctext: '#4C4F69',
        subtext1: '#5C5F77',
        subtext0: '#6C6F85',
        overlay0: '#9CA0B0',
        mauve: '#8839EF',
        peach: '#FE640B',
        green: '#40A02B',
        red: '#D20F39',
        blue: '#1E66F5',
        teal: '#179299',
        yellow: '#DF8E1D',
        pink: '#EA76CB',
      },
      borderRadius: {
        // 编辑纸感：克制圆角，不用大圆角 + 通用阴影
        DEFAULT: '3px',
        lg: '5px',
        xl: '8px',
      },
      typography: {
        DEFAULT: {
          css: {
            // prose 配色对齐 catppuccin Latte（修复 prose-sm 之前不生效）
            color: '#4C4F69',
            a: { color: '#8839EF' },
            strong: { color: '#4C4F69' },
            code: { color: '#8839EF', background: '#E6E9EF' },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
          },
        },
      },
    },
  },
  plugins: [typography],
}
