# 当代打工人的吐槽日常

Next.js + TypeScript + Tailwind CSS + Supabase 的赛博朋克匿名吐槽社区 MVP。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## Supabase 配置

1. 在 Supabase 新建项目。
2. 打开 Supabase SQL Editor，执行 [supabase/schema.sql](supabase/schema.sql)。
3. 复制 `.env.local.example` 为 `.env.local`。
4. 填入：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

旧项目也可以用：

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 已实现

- 用户注册、登录、退出
- `profiles` 自动创建 username
- `posts` 增删查
- `comments` 查询和发布，前台文案为“支招一下”
- `reactions` 支持“俺也一样”按钮，一人一赞
- `reports` 支持帖子和评论“上报 HR 审查”
- `mood_score` 破防指数：1 还能忍、2 有点烦、3 想摸鱼、4 快破防、5 直接离职
- 帖子卡片用分段灯条视觉化展示破防指数
- 本地交互支持“存档摸鱼”
- 发帖和评论支持 `anonymous_mode`
- `anonymous_mode = true` 时前台显示 `anonymous_name`
- `anonymous_mode = false` 时前台显示真实 `username`

## 数据读取

前端主要读取两个 Supabase view：

- `post_feed`：帖子列表，包含作者显示名、支招数、反应数、`mood_score`
- `comment_feed`：评论列表，包含匿名/真实显示名

写操作仍然写入原表：`posts`、`comments`、`reactions`、`reports`。
