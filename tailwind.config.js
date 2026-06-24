/** @type {import('tailwindcss').Config} */

// xAI 风格主题：深空黑底 + 单一冷蓝点缀 + 暖琥珀地平线
// 字体 weight 400 only，letter-spacing -0.025em，hairline 边框，无阴影
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // xAI 色板
        void: {
          DEFAULT: "#0c0c0b", // Void Black - 画布、输入填充
        },
        graphite: {
          DEFAULT: "#1f2228", // Graphite - hairline 边框
          deep: "#141619", // Charcoal - 深层结构边
        },
        smoke: {
          DEFAULT: "#474747", // Smoke - 抬升表面边框
        },
        ash: {
          DEFAULT: "#7d8187", // Ash - 次文本、徽章
        },
        bone: {
          DEFAULT: "#71717a", // Bone - 输入 focus ring
        },
        stellar: {
          DEFAULT: "#ffffff", // Stellar White - 主文本、图标
        },
        signal: {
          DEFAULT: "#2563eb", // Signal Blue - 仅输入 focus border
        },
        danger: "#ef4444",
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
        "mono-badge": ["0.75rem", { lineHeight: "1.33", letterSpacing: "0.1em" }],
        "mono-label": ["0.875rem", { lineHeight: "1.43", letterSpacing: "0.1em" }],
      },
      letterSpacing: {
        tightest: "-0.025em",
        tracked: "0.1em",
      },
      borderRadius: {
        input: "24px",
        pill: "9999px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "cursor-blink": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        // 流式文字光效：每个字符出现时短暂发光
        "token-glow": {
          "0%": {
            opacity: "0",
            filter: "blur(6px) brightness(2.4)",
            transform: "translateY(2px)",
          },
          "40%": {
            opacity: "1",
            filter: "blur(0) brightness(1.6)",
            transform: "translateY(0)",
          },
          "100%": {
            opacity: "1",
            filter: "blur(0) brightness(1)",
            transform: "translateY(0)",
          },
        },
        // 流式光标脉冲
        "cursor-pulse": {
          "0%,100%": { opacity: "0.4", boxShadow: "0 0 6px rgba(255,255,255,0.4)" },
          "50%": { opacity: "1", boxShadow: "0 0 14px rgba(255,255,255,0.9)" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "breathe": {
          "0%,100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.3s ease-out both",
        "cursor-blink": "cursor-blink 1s steps(2) infinite",
        "cursor-pulse": "cursor-pulse 1.2s ease-in-out infinite",
        "token-glow": "token-glow 0.6s cubic-bezier(0.22,1,0.36,1) both",
        "spin-slow": "spin-slow 1.1s linear infinite",
        "breathe": "breathe 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
