module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "next/typescript", "prettier"],
  plugins: ["tailwindcss", "testing-library", "jest-dom"],
  settings: {
    tailwindcss: {
      callees: ["cn"],
      config: "tailwind.config.ts",
    },
  },
  rules: {
    "tailwindcss/classnames-order": "warn",
    "tailwindcss/no-custom-classname": "off",
  },
  overrides: [
    {
      files: ["**/__tests__/**/*.{js,jsx,ts,tsx}", "**/*.{spec,test}.{js,jsx,ts,tsx}"],
      globals: {
        vi: "readonly",
      },
      extends: ["plugin:testing-library/react"],
      rules: {
        "testing-library/no-container": "warn",
        "testing-library/no-node-access": "warn",
        "testing-library/prefer-screen-queries": "warn",
        "jest-dom/prefer-checked": "warn",
        "jest-dom/prefer-enabled-disabled": "warn",
      },
    },
  ],
  ignorePatterns: [".next/", "out/", "build/", "coverage/", "next-env.d.ts"],
};
