# `plan.md` - WebOS Linux 管理面板开发计划

## 1. 项目概述与架构设计
**项目目标：** 开发一个基于 Web 的 Linux 系统管理工具，前端提供完全仿制最新 macOS (Sonoma/Sequoia) 的桌面交互体验，后端提供安全稳定的系统级 API 控制。
**技术栈：**
* **前端:** Angular (最新版本) + NG-ZORRO (Ant Design of Angular) + TailwindCSS (辅助原子类布局与模糊特效)
* **后端:** Golang + Gin (Web 框架) + SQLite (本地配置存储)
* **核心通信:** RESTful API + WebSockets (用于终端实时通信)

**目录结构约定 (Monorepo 推荐)：**
```text
/webos-linux-panel
├── /backend             # Golang 后端目录
│   ├── /api             # 控制器 (Gin Handlers)
│   ├── /core            # 核心业务逻辑 (系统信息, 文件操作, PTY)
│   ├── /models          # SQLite 数据库模型 (GORM)
│   ├── /routes          # 路由注册
│   ├── /ws              # WebSocket 服务
│   └── main.go          # 入口文件
└── /frontend            # Angular 前端目录
    ├── /src
    │   ├── /app
    │   │   ├── /core    # 核心服务 (认证, WindowManager, WebSocket)
    │   │   ├── /shared  # 共享 UI 组件 (Dock, MenuBar, WindowWrapper)
    │   │   ├── /apps    # 独立的应用模块 (Finder, Terminal, Settings)
    │   │   └── app.component.ts # 桌面基础布局
```

---

## 2. 阶段一：基础设施与后端核心搭建 (Golang)
**目标：** 搭建后端基础框架，实现数据库连接，并提供基础的认证和系统信息获取接口。

* [ ] **任务 1.1: 初始化 Golang 项目**
    * 执行 `go mod init webos-panel`。
    * 安装依赖：`github.com/gin-gonic/gin`, `gorm.io/gorm`, `gorm.io/driver/sqlite`, `github.com/golang-jwt/jwt/v5`。
* [ ] **任务 1.2: 数据库与认证 (Auth)**
    * 使用 GORM 初始化 SQLite 数据库 `webos.db`。
    * 创建 `User` 和 `SystemConfig` 表。
    * 实现基于 JWT 的登录验证，提供 `/api/login` 接口，并编写 Gin Middleware 拦截未授权请求。
* [ ] **任务 1.3: 系统基础信息采集 (Settings 依赖)**
    * 引入 `github.com/shirou/gopsutil/v3` 库。
    * 编写 `/api/sysinfo/overview` 接口，返回 CPU、内存、磁盘使用率、OS 版本（精确识别 Debian/Ubuntu 等发行版）和运行时间。

---

## 3. 阶段二：前端 macOS 桌面系统级交互 (Angular)
**目标：** 构建 macOS 的视觉外壳，最核心的是实现一个全局的**窗口管理系统 (Window Manager)**。

* [ ] **任务 2.1: 初始化 Angular 项目与 UI 库**
    * 执行 `ng new frontend --routing --style=scss`。
    * 安装并配置 NG-ZORRO (`ng add ng-zorro-antd`) 和 TailwindCSS。
* [ ] **任务 2.2: 全局窗口管理器服务 (`WindowManagerService`)**
    * **核心难点：** 编写一个 Angular Service 维护当前打开的“应用”列表（如 Finder, Terminal）。
    * 需包含状态：`appId`, `title`, `zIndex` (层级控制), `isMinimized`, `isMaximized`, `position (x, y)`, `size (width, height)`。
    * 当点击应用时，将其 `zIndex` 提升至最高。
* [ ] **任务 2.3: 开发 macOS 布局组件**
    * **Top Menu Bar:** 顶部状态栏，左侧显示苹果(或自定义)Logo 和当前激活应用的菜单，右侧显示时间、网络、控制中心图标（利用 Tailwind 的 `backdrop-filter: blur` 实现毛玻璃效果）。
    * **Dock:** 底部应用程序坞，悬浮放大效果（可使用 CSS 配合 Angular 动画实现）。
    * **Window Wrapper 组件:** 这是一个通用容器组件，用于包裹 Finder/Terminal。必须包含 macOS 经典的红黄绿三大控制按钮（关闭、最小化、全屏），并引入 `@angular/cdk/drag-drop` 实现窗口拖拽和缩放。

---

## 4. 阶段三：核心应用 - Web Terminal (终端管理)
**目标：** 在浏览器中实现流畅的、具有 Linux root/user 权限的真实终端。

* [ ] **任务 3.1: 后端 PTY 与 WebSocket (Golang)**
    * 引入 `github.com/creack/pty` 创建伪终端。
    * 引入 `github.com/gorilla/websocket` 实现持久化连接。
    * 编写 `/ws/terminal` 路由。当连接建立时，启动 `/bin/bash` 或 `/bin/zsh`，将 PTY 的标准输入/输出与 WebSocket 绑定。监听前端传来的窗口 Resize 事件，调整后端 PTY 的 `rows` 和 `cols`。
* [ ] **任务 3.2: 前端 Xterm.js 接入 (Angular)**
    * 安装依赖：`xterm`, `xterm-addon-fit`, `xterm-addon-webgl`。
    * 在前端创建一个 Terminal 组件（受 WindowManager 管理）。
    * 初始化 Xterm 实例，连接后端的 WebSocket。
    * 使用 `xterm-addon-fit` 确保终端大小随 Angular 窗口缩放而自适应。配置配色方案以符合 macOS Terminal 默认风格或深色模式。

---

## 5. 阶段四：核心应用 - Finder (文件管理)
**目标：** 实现类似于 macOS Finder 的文件浏览器，支持对 Linux 文件系统的完整操作。

* [ ] **任务 4.1: 后端文件系统 API (Golang)**
    * 提供一套 RESTful API：
        * `GET /api/fs/list?path=/` - 列出目录内容（包含名称、大小、权限、修改时间、类型，过滤掉无权访问的系统核心文件，除非以 root 运行）。
        * `POST /api/fs/create` - 创建文件/文件夹。
        * `DELETE /api/fs/delete` - 删除。
        * `PUT /api/fs/rename` - 重命名。
        * `POST /api/fs/upload` - 处理文件上传。
        * `GET /api/fs/download` - 处理文件下载。
* [ ] **任务 4.2: 前端 Finder 界面实现 (Angular + NG-ZORRO)**
    * **布局:** 左侧 Sidebar 放置快捷路径 (Home, Root, Downloads)，右侧为内容区。
    * **视图切换:** 实现“图标视图 (Icon)”和“列表视图 (Table)”两种展示方式（使用 `nz-table`）。
    * **交互:** 实现双击进入文件夹，顶部面包屑 (Breadcrumb) 导航。
    * **右键菜单:** 使用 NG-ZORRO 的 `nz-dropdown` 实现自定义的右键菜单（复制、粘贴、删除、新建、权限修改）。

---

## 6. 阶段五：核心应用 - System Settings (系统设置)
**目标：** 提供对 Linux 服务的可视化配置面板，界面仿照 macOS 的“系统设置”。

* [ ] **任务 6.1: 界面布局设计**
    * 使用左侧紧凑的 `nz-menu` 作为设置分类（如：网络、安全、服务、关于本机），右侧为具体的表单配置区。
* [ ] **任务 6.2: 核心功能实现**
    * **关于本机:** 调用阶段一的 `/api/sysinfo/overview` 接口，仿照 macOS 的“关于本机” UI 展示系统 Logo、CPU、内存等硬件信息。
    * **系统服务管理 (Systemd):** (进阶功能) 后端通过执行 `systemctl status/start/stop` 命令，前端展示关键服务列表并提供开关控件。
    * **网络信息:** 展示当前 IP 配置（IPv4/IPv6）和基础路由信息。

---

## 7. 阶段六：打包与部署 (Sysadmin 友好向)
**目标：** 将前后端打包为一个易于部署的单一二进制文件。

* [ ] **任务 7.1: 前端静态构建**
    * 配置 Angular 生产环境编译 `ng build --configuration production`。
* [ ] **任务 7.2: Golang `embed` 静态资源**
    * 在 Golang 中引入 `embed` 标准库。
    * 将 Angular 构建出的 `dist` 目录打包进 Go 二进制文件中。
    * 配置 Gin 路由，处理 SPA (单页应用) 的路由 fallback 问题，确保刷新浏览器不会 404。
* [ ] **任务 7.3: 交叉编译**
    * 编写一个 `Makefile` 或 `build.sh`，支持编译出适用于不同架构的执行文件 (例如 `GOOS=linux GOARCH=amd64` 或 `GOOS=linux GOARCH=arm64`)。