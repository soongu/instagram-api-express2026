// ~/instagram-api/lab/p2-29/prisma.config.js
import { defineConfig } from 'prisma/config';

process.loadEnvFile();

export default defineConfig({
  schema: 'schema.prisma',
  migrations: { path: 'migrations' },
  datasource: { url: process.env.BOOKSTORE_URL },
});
