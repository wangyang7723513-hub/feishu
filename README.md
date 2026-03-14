# 家庭共享日历

这是一个专为家庭设计的简单日历应用，支持手机访问，界面美观（iOS 风格），并针对长辈进行了字体和操作优化。

## ✨ 功能特点

*   **极简操作**：点击头像即可登录，无需记忆密码。
*   **适老化设计**：大字体、高对比度、大按钮，方便长辈使用。
*   **日历视图**：清晰的月视图，直观展示每天的日程（红点标记）。
*   **家庭共享**：支持云端同步，全家人在各自手机上都能看到最新日程。

## 🚀 快速开始

### 方式一：本地演示（仅自己看）
1. 直接在浏览器中打开 `index.html` 文件。
2. 数据将保存在当前浏览器中，不会上传到云端。

### 方式二：家庭真实共享（推荐）
为了实现全家人共享，我们需要一个免费的云数据库（Supabase）。请按照以下步骤配置：

#### 1. 获取云端 Key
1. 访问 [Supabase.com](https://supabase.com/) 并注册一个免费账号。
2. 点击 "New Project" 创建一个新项目（名称随意，如 `family-calendar`）。
3. 等待数据库初始化完成（约1-2分钟）。
4. 进入左侧菜单的 **SQL Editor**，点击 "New query"，复制并运行以下代码来创建数据表：

```sql
create table events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  date text not null,
  time text,
  member_id text not null,
  creator_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 开启安全策略
alter table events enable row level security;

-- 允许任何人读写（家庭内部使用方便）
create policy "Allow anonymous access"
on events
for all
to anon
using (true)
with check (true);
```

5. 点击运行（Run）。
6. 进入左侧菜单的 **Project Settings** -> **API**。
7. 找到 **Project URL** 和 **anon public key**，复制它们。

#### 2. 配置应用
1. 打开日历应用。
2. 在登录页点击底部的 **“配置共享”** 按钮。
3. 填入刚才复制的 URL 和 Key。
4. 点击保存。

现在，只要把这个网页部署到网上（或者把文件发给家人），所有人在配置了相同的 Key 之后，就能看到一样的数据了！

## 👨‍👩‍👧‍👦 预设家庭成员
目前代码中预设了以下角色（可在 `src/app.js` 中修改）：
*   👨🏻 爸爸
*   👩🏻 妈妈
*   👴🏻 爷爷
*   👵🏻 奶奶
*   👶🏻 宝贝

## 🛠 技术栈
*   HTML5 / JavaScript (ES6+)
*   Tailwind CSS (样式)
*   Supabase (云端数据库)
*   Phosphor Icons (图标)
