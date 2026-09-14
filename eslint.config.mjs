import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // sdk/ 是独立发布给用户的包，按自己的规则走，不受站点的 Next 规则约束。
  // ecosystem.config.cjs 是给 PM2 的 CommonJS 配置，不是站点代码，别拿 Next 的规则去套。
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'dist.prev/**',
    'next-env.d.ts',
    'sdk/**',
    'ecosystem.config.cjs',
  ]),
]);

export default eslintConfig;
