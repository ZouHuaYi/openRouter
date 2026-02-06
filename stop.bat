@echo off
set PORT=3333
powershell -NoProfile -Command "$p = Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess; if ($p) { Stop-Process -Id $p -Force; Write-Host 'Gateway stopped (PID' $p ').' } else { Write-Host 'No gateway process on port %PORT%.' }"
