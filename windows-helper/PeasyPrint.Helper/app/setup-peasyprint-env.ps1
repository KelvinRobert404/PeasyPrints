[Environment]::SetEnvironmentVariable("PEASYPRINT_API_KEY","YOUR_SECURE_TOKEN","User")
Write-Host "Set PEASYPRINT_API_KEY for current user." -ForegroundColor Green
try {
  Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
  Start-Process explorer.exe
  Write-Host "Restarted Explorer to apply environment changes." -ForegroundColor Yellow
} catch {}
