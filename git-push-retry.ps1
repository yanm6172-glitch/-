# git-push-retry.ps1
# 上传到 GitHub，网络不稳时自动重试，直到与远程同步。
# 用法:  pwsh -File git-push-retry.ps1 [-Branch main] [-MaxAttempts 12] [-SleepSeconds 8] [-Url <https或ssh地址>]
# 说明:  -Url 省略时使用当前 remote (origin)；显式传 https://github.com/... 可绕过本地 SSH 配置。
param(
  [string]$Branch = "main",
  [int]$MaxAttempts = 12,
  [int]$SleepSeconds = 8,
  [string]$Url = ""
)

$ErrorActionPreference = "Continue"
$env:GIT_TERMINAL_PROMPT = "0"
if ($Url) { $target = $Url } else { $target = "origin" }

for ($i = 1; $i -le $MaxAttempts; $i++) {
  $local = git rev-parse $Branch 2>$null
  $remote = (git ls-remote $target "refs/heads/$Branch" 2>$null) -split "`t" | Select-Object -First 1
  if ($local -and ($local -eq $remote)) {
    Write-Host ("[OK] 已同步 (第{0}次检查): {1}" -f $i, $local) -ForegroundColor Green
    exit 0
  }
  Write-Host ("[{0}/{1}] 推送中 local={2} remote={3}..." -f $i, $MaxAttempts, $local, $remote) -ForegroundColor Cyan
  git push $target "$($Branch):$($Branch)" 2>&1 | Select-Object -Last 2
  Start-Sleep -Seconds $SleepSeconds
}
Write-Host "未能在重试次数内完成同步" -ForegroundColor Red
exit 1
