# 47° · 我的唱片室

一个把音乐收藏做成实体唱片架的个人网站：用立体专辑封面浏览收藏，打开专辑后展开纸质折页手册。

**在线体验：[47-degree-music-room.pages.dev](https://47-degree-music-room.pages.dev/)**

## 功能

- 3D 唱片架，支持拖动、滚轮和左右切换。
- 专辑封面与折页手册，展示曲目和背景介绍。
- 根据专辑名或歌手名搜索收藏。
- 粘贴公开网易云专辑链接，导入封面及曲目。
- 三击专辑管理名称、艺人、年份和介绍，支持删除。
- 个人账号、独立唱片收藏和本地播放历史。

播放是否可用取决于网易云的版权和访问限制，部分曲目只能浏览信息。当前不提供密码重置邮件。旧服务中的账号和收藏未自动迁移。

## 技术

Vite、Three.js、GSAP；Cloudflare Pages Functions 提供 API，D1 保存账号、会话及每个账号的唱片。密码使用加盐 PBKDF2 哈希，会话使用 HttpOnly Cookie。仓库不包含生产数据库或用户数据。

## 本地运行

安装 Node.js 22 或更新版本后执行：

```sh
npm ci
npm run dev
```

Vite 开发模式用于预览前端，本地账号服务不可用时会使用浏览器本地收藏。`npm run preview` 也仅预览静态构建。

需要测试完整账号和 API 时，先按照下方说明创建自己的 D1，并修改 `wrangler.jsonc` 中的数据库配置，然后运行：

```sh
npm run build
npx wrangler d1 execute 47-degree-music-room-db --local --file migrations/0001_auth.sql
npx wrangler pages dev dist
```

## 部署到自己的 Cloudflare

```sh
npx wrangler login
npx wrangler d1 create 47-degree-music-room-db
```

将命令返回的 `database_id` 填入 `wrangler.jsonc`，保留绑定名 `DB`。仓库中的数据库编号是原作者部署标识，不授予数据库访问权限；复制部署时必须换为自己的编号。Pages 项目名也应改为自己账户中的项目名。

```sh
npx wrangler d1 execute 47-degree-music-room-db --remote --file migrations/0001_auth.sql
npx wrangler pages project create YOUR_PROJECT_NAME --production-branch main
npm run build
npx wrangler pages deploy dist --project-name YOUR_PROJECT_NAME --branch main
```

登录凭据由 Wrangler 管理，不应写入源码。发布目录是 `dist`；Pages 同时编译项目中的 `functions`。数据库绑定配置位于 `wrangler.jsonc`。

## 目录

```text
src/              唱片架、播放器与界面
functions/        账号、收藏和网易云代理 API
migrations/       D1 数据表结构
index.html        页面结构
wrangler.jsonc    Cloudflare Pages 与 D1 配置
```

专辑封面、艺人名称和音乐等内容属于各自权利人，仓库不分发音乐文件。该项目目前未附加开源许可证。
