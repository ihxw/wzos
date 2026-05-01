Write-Host "Starting WZOS Development Environment..." -ForegroundColor Green

# Start Backend
Write-Host "Starting Go Backend (Port: 8080)..." -ForegroundColor Cyan
Start-Process powershell -WorkingDirectory "$PSScriptRoot\backend" -ArgumentList "-NoExit", "-Command", "go run ."

# Start Frontend
Write-Host "Starting Angular Frontend (Port: 4200)..." -ForegroundColor Cyan
Start-Process powershell -WorkingDirectory "$PSScriptRoot\frontend" -ArgumentList "-NoExit", "-Command", "npm start"

Write-Host "Services have been started in separate windows." -ForegroundColor Yellow
