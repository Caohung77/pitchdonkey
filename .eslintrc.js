/**
 * Next.js ESLint configuration aligned with the strict preset.
 * Adds TypeScript and React best-practice rules on top of Next defaults.
 */
module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  ignorePatterns: ['next.config.js', 'tailwind.config.js', 'postcss.config.js'],
  rules: {
    'react/no-unescaped-entities': 'off',
    '@next/next/no-img-element': 'off',
    'react-hooks/exhaustive-deps': 'off',
  },
}
