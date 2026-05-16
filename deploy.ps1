# WZOS 本地交叉编译并部署到 Linux ARM64
# 用法: .\deploy.ps1 -TargetHost 192.168.1.151 -User root

param(
    [string]$TargetHost = "192.168.1.151",
    [string]$User = "root",
    [string]$Arch = "arm64",
    [switch]$ResetDb
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Dist = Join-Path $Backend "dist"
$OutBin = Join-Path $Root "wzos-panel-linux-$Arch"

Write-Host "==> 1/4 构建前端..." -ForegroundColor Cyan
Push-Location $Frontend
npm run build --if-present
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Pop-Location

$BrowserDist = Join-Path $Frontend "dist\frontend\browser"
if (-not (Test-Path $BrowserDist)) {
    throw "未找到前端构建产物: $BrowserDist"
}

Write-Host "==> 2/4 复制前端到 backend/dist ..." -ForegroundColor Cyan
if (Test-Path $Dist) { Remove-Item -Recurse -Force $Dist }
New-Item -ItemType Directory -Path $Dist | Out-Null
Copy-Item -Recurse (Join-Path $BrowserDist "*") $Dist

Write-Host "==> 3/4 本地交叉编译 (linux/$Arch, CGO_ENABLED=0) ..." -ForegroundColor Cyan
Push-Location $Backend
$env:GOOS = "linux"
$env:GOARCH = $Arch
$env:CGO_ENABLED = "0"
go build -trimpath -ldflags="-s -w" -o $OutBin .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Remove-Item Env:GOOS, Env:GOARCH, Env:CGO_ENABLED -ErrorAction SilentlyContinue
Pop-Location

$Remote = "${User}@${TargetHost}"
$RemoteBin = "/opt/wzos/wzos-panel"

Write-Host "==> 4/4 上传到 $Remote ..." -ForegroundColor Cyan
ssh $Remote "mkdir -p /opt/wzos /var/lib/wzos"
scp $OutBin "${Remote}:${RemoteBin}.new"
$remoteScript = "set -e; chmod +x ${RemoteBin}.new; systemctl stop wzos 2>/dev/null || true; mv -f ${RemoteBin}.new ${RemoteBin}"
if ($ResetDb) { $remoteScript += "; rm -f /var/lib/wzos/wzos.db" }
$remoteScript += "; systemctl daemon-reload 2>/dev/null || true; systemctl enable wzos 2>/dev/null || true; systemctl start wzos; sleep 2; curl --noproxy '*' -s -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:8080/"
ssh $Remote $remoteScript

Write-Host ""
Write-Host "部署完成: http://${TargetHost}:8080" -ForegroundColor Green
Write-Host "默认账号: admin / admin" -ForegroundColor Yellow
if (-not $ResetDb) {
    Write-Host "若仍无法登录，请执行: .\deploy.ps1 -TargetHost $TargetHost -ResetDb" -ForegroundColor Yellow
}
