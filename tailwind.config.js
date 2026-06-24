/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 静谧智识主题：近黑底 + 暖琥珀 + 翡翠
        ink: {
          DEFAULT: "#0d0d0f", // 主背景
          surface: "#16161a", // 表面层
          raised: "#1c1c22", // 抬升层（输入框、卡片）
          border: "#26262c", // 边框
          hairline: "#202026", // 细分割线
        },
        cloud: {
          DEFAULT: "#f5a623", // 暖琥珀 - 云端/主操作
          soft: "#7a5a1f",
          glow: "rgba(245,166,35,0.18)",
        },
        local: {
          DEFAULT: "#34d399", // 翡翠绿 - 本地/安全
          soft: "#1f6b54",
          glow: "rgba(52,211,153,0.16)",
        },
        danger: "#ef4444",
        content: {
          DEFAULT: "#ededed", // 主文本
          muted: "#8a8a93", // 次文本
          faint: "#5c5c66", // 弱文本
        },
      },
      fontFamily: {
        display: ['"Sora"', "system-ui", "sans-serif"],
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(245,166,35,0.25), 0 8px 30px -8px rgba(245,166,35,0.35)",
        "glow-local": "0 0 0 1px rgba(52,211,153,0.25), 0 8px 30px -8px rgba(52,211,153,0.30)",
        soft: "0 8px 30px -12px rgba(0,0,0,0.6)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "cursor-blink": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s cubic-bezier(0.22,1,0.36,1) both",
        "cursor-blink": "cursor-blink 1s steps(2) infinite",
        "pulse-ring": "pulse-ring 1.4s ease-out infinite",
        "spin-slow": "spin-slow 1.1s linear infinite",
        shimmer: "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [],
};
