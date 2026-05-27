// prisma/prisma.config.ts
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  // 告诉 Prisma 你的 schema 文件在哪里
  schema: path.join("prisma", "schema.prisma"),
  // 在这里配置数据库连接字符串（用于 prisma migrate, db push 等命令）
  datasource: {
    url: process.env.DATABASE_URL, 
  },
});