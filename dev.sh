#!/bin/bash

# Color codes
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

BACKEND_PORT=8080
FRONTEND_PORT=4200
BACKEND_PID=""
FRONTEND_PID=""

log()  { echo -e "${CYAN}$*${NC}"; }
ok()   { echo -e "${GREEN}$*${NC}"; }
warn() { echo -e "${YELLOW}$*${NC}"; }
err()  { echo -e "${RED}$*${NC}"; }

cleanup() {
    warn "\n[!] 正在关闭所有服务..."
    [[ -n "$BACKEND_PID"  ]] && kill "$BACKEND_PID"  2>/dev/null
    [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null
    wait 2>/dev/null
    ok "[√] 环境已清理。"
    exit 0
}
trap cleanup SIGINT SIGTERM

# ---------- 1. 检查依赖 ----------
ok "======================================"
ok "   WZOS 一键启动开发调试环境"
ok "======================================"

log "[1/4] 检查环境依赖..."
for cmd in go node npm; do
    command -v "$cmd" &>/dev/null || { err "[错误] 未找到 $cmd，请确保已安装。"; exit 1; }
done

# ---------- 2. 安装前端依赖 ----------
if [[ ! -d "frontend/node_modules" ]]; then
    warn "[!] 未检测到前端 node_modules，正在执行 npm install..."
    (cd frontend && npm install --no-fund --no-audit)
fi

# ---------- 3. 清理旧进程 ----------
log "[2/4] 清理占用端口 $BACKEND_PORT / $FRONTEND_PORT 的旧进程..."
for port in $BACKEND_PORT $FRONTEND_PORT; do
    if command -v lsof &>/dev/null; then
        lsof -ti:"$port" | xargs kill -9 2>/dev/null || true
    elif command -v fuser &>/dev/null; then
        fuser -k "$port/tcp" 2>/dev/null || true
    fi
done
sleep 0.5

# ---------- 4. 启动后端 ----------
log "[3/4] 启动 Go 后端 (端口: $BACKEND_PORT)..."
(cd backend && go run . 2>&1 | sed "s/^/${CYAN}[Backend] ${NC}/") &
BACKEND_PID=$!

# 等待后端就绪 (最多 30 秒)
log "等待后端就绪..."
for i in $(seq 1 30); do
    if curl -sf "http://localhost:$BACKEND_PORT/api/files/list" >/dev/null 2>&1; then
        ok "后端已就绪。"
        break
    fi
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        err "[错误] 后端进程异常退出。"
        exit 1
    fi
    if [[ $i -eq 30 ]]; then
        err "[错误] 后端启动超时 (30s)。"
        exit 1
    fi
    sleep 1
done

# ---------- 5. 启动前端 ----------
log "[4/4] 启动 Angular 前端 (端口: $FRONTEND_PORT)..."
export NG_CLI_ANALYTICS=false
(cd frontend && npx ng serve 2>&1 | sed "s/^/${GREEN}[Frontend] ${NC}/") &
FRONTEND_PID=$!

ok "======================================"
ok "  服务已全部启动！"
ok "  后端: http://localhost:$BACKEND_PORT"
ok "  前端: http://localhost:$FRONTEND_PORT"
ok "  按下 Ctrl+C 停止所有服务"
ok "======================================"

# 保持脚本运行，等待所有后台进程
wait
