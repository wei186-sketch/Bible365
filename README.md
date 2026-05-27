# Bible365 MVP

移动端优先的 365 天读经打卡系统（用户上传音频 + 打卡 + 管理员上传公共音频）。

## 功能

- 用户登录（账号密码）
- 用户上传音频（mp3/m4a/wav，20MB以内）
- 每日打卡（选择某天 + 选择自己的音频）
- 打卡记录可视化（365天方格）
- 音频广场（可听自己的、他人的、管理员上传的音频）
- 管理员上传公共音频
- 管理员查看用户列表

## 一键启动（Docker）

在仓库根目录执行：

```bash
docker compose up -d --build
```

访问：`http://你的服务器IP:3000`

默认管理员（首次自动初始化）：

- 账号：`admin`
- 密码：`admin123`

## 本地开发

```bash
cd web
pnpm install
pnpm exec prisma generate
pnpm exec prisma db push
pnpm dev
```

开发环境数据库连接在 [`.env`](C:/Users/hfhfh/bible365/web/.env)。

## 目录

- 前端和API：[`/web/src/app`](C:/Users/hfhfh/bible365/web/src/app)
- Prisma模型：[`/web/prisma/schema.prisma`](C:/Users/hfhfh/bible365/web/prisma/schema.prisma)
- 上传目录：`/web/uploads`
- 编排文件：[`/docker-compose.yml`](C:/Users/hfhfh/bible365/docker-compose.yml)

## 备注

- 当前是 MVP 骨架，认证是轻量模式（请求头携带用户ID）。
- 正式上线前建议加：JWT/Cookie会话、限流、审计日志、对象存储和备份策略。

