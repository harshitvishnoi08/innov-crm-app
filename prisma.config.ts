import * as dotenv from "dotenv";
dotenv.config();
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.js",
  },
  datasource: {
    // Migrations need a direct session connection, not the transaction pooler.
    url: env("DIRECT_URL"),
  },
});