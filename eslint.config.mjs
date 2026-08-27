import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // sdk/ 是独立发布给用户的包，按自己的规则走，不受站点的 Next 规则约束
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'sdk/**']),
]);

export default eslintConfig;
