#!/bin/bash

# Color codes for better visibility
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================"
echo -e "   WZOS 一键启动开发调试环境 (Linux)"
echo -e "======================================${NC}"

# 1. 检查必要依赖
check_dep() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}[错误] 未找到 $1，请确保已安装。${NC}"
        exit 1
    fi
}

echo -e "${CYAN}[1/4] 检查环境依赖...${NC}"
check_dep "go"
check_dep "node"
check_dep "npm"

# 检查前端 node_modules
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}[!] 未检测到前端 node_modules，正在执行 npm install...${NC}"
    (cd frontend && npm install)
fi

# 2. 清理旧进程 (如果端口被占用)
echo -e "${CYAN}[2/4] 检查并清理旧进程 (Port 8080, 4200)...${NC}"
# 尝试使用 lsof 或 fuser 清理端口
if command -v lsof &> /dev/null; then
    lsof -ti:8080,4200 | xargs kill -9 2>/dev/null
elif command -v fuser &> /dev/null; then
    fuser -k 8080/tcp 4200/tcp 2>/dev/null
fi

# 3. 定义清理函数 (Ctrl+C 退出时触发)
cleanup() {
    echo -e "\n${YELLOW}[!] 正在关闭所有服务...${NC}"
    # 终止后台进程组
    kill $(jobs -p) 2>/dev/null
    echo -e "${GREEN}[√] 环境已清理。${NC}"
    exit
}

trap cleanup SIGINT SIGTERM

# 4. 启动后端和前端
echo -e "${CYAN}[3/4] 启动 Go 后端 (端口: 8080)...${NC}"
(cd backend && go run . 2>&1 | sed "s/^/${CYAN}[Backend] ${NC}/") &

# 等待后端启动一会
sleep 2

echo -e "${CYAN}[4/4] 启动 Angular 前端 (端口: 4200)...${NC}"
# 设置环境变量禁用 Angular CLI 的交互式提示
export NG_CLI_ANALYTICS=false
(cd frontend && npm start -- --no-interactive 2>&1 | sed "s/^/${GREEN}[Frontend] ${NC}/") &

echo -e "${GREEN}======================================"
echo -e "  服务已全部启动！"
echo -e "  后端: http://localhost:8080"
echo -e "  前端: http://localhost:4200"
echo -e "  按下 Ctrl+C 停止所有服务"
echo -e "======================================"

# 保持脚本运行，等待后台任务
wait
