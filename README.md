# Read365

移动端优先的 365 天读书音频打卡系统。

## 功能

### 用户端
- 账号密码登录
- 上传音频（mp3/m4a/wav/webm/aac，支持大文件）
- 在线录音并上传
- 每日打卡（选择日期 + 音频）
- 年度概览（365天月度格子图，每月一行）
- 实时动态（当天打卡记录，支持日期筛选）
- 排行榜（按打卡天数降序，同天数按当天最后打卡时间升序）
- 同部门用户可查看彼此年度概览

### 管理员端
- 用户管理：创建/编辑/删除/批量导入
- CSV 批量导入/修改/导出用户
- 部门管理
- 公告管理
- 文件管理（公共音频上传/分类）
- 审计日志
- 数据导出

## 技术栈

- **前端**: Next.js 16 + React + Tailwind CSS
- **后端**: Next.js API Routes
- **数据库**: PostgreSQL 16 + Prisma ORM
- **部署**: Docker Compose
- **外网**: frp 隧道

## 一键启动

`ash
docker compose up -d --build
`

访问：http://服务器IP:3000

默认管理员账号：

- 账号：dmin
- 密码：dmin123

## 目录结构

`
├── docker-compose.yml
├── Dockerfile
├── package.json
├── next.config.ts
├── prisma/
│   └── schema.prisma
├── public/
└── src/
    └── app/
        ├── api/          # API 路由
        ├── components/   # 页面组件
        ├── login/        # 登录页
        ├── layout.tsx    # 根布局
        └── page.tsx      # 首页
`

## 本地开发

`ash
pnpm install
pnpm exec prisma generate
pnpm exec prisma db push
pnpm dev
`

## 环境变量

| 变量 | 说明 |
|------|------|
| DATABASE_URL | PostgreSQL 连接串 |
| JWT_SECRET | JWT 签名密钥 |

## 许可

MIT
