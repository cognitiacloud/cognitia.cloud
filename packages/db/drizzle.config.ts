import { defineConfig } from 'drizzle-kit';
import { env } from '@cognitia/config';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url: env.DATABASE_URL },
  casing: 'snake_case',
});
