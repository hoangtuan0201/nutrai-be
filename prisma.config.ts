import dotenv from "dotenv";
import { expand } from "dotenv-expand";
import { defineConfig } from "prisma/config";

expand(dotenv.config());

export default defineConfig({
  schema: "src/database/prisma/schema.prisma",
  migrations: {
    path: "src/database/prisma/migrations",
    seed: 'npx ts-node --compiler-options {"module":"CommonJS"} src/database/prisma/seed.ts',
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
