# PowerShell prompt integration

Adds a `5h:42% 7d:88%` segment to your PowerShell prompt.

Add to your profile (`$PROFILE`):

```powershell
function global:prompt {
  $segment = $null
  if (Get-Command claude-usage -ErrorAction SilentlyContinue) {
    $segment = (claude-usage prompt --no-color 2>$null)
  }
  $location = (Get-Location).Path
  if ($segment) {
    "$env:USERNAME $location  $segment`nPS> "
  } else {
    "$env:USERNAME $location`nPS> "
  }
}
```

## Cached version

Refresh in the background, read from a cache file in the prompt:

```powershell
$global:ClaudeUsageCachePath = Join-Path $env:TEMP 'claude-usage.txt'

if (-not $global:ClaudeUsageJob) {
  $global:ClaudeUsageJob = Start-Job -ScriptBlock {
    param($cachePath)
    while ($true) {
      try {
        claude-usage prompt --no-color | Out-File -FilePath $cachePath -Encoding utf8
      } catch { }
      Start-Sleep -Seconds 60
    }
  } -ArgumentList $global:ClaudeUsageCachePath
}

function global:prompt {
  $segment = ''
  if (Test-Path $global:ClaudeUsageCachePath) {
    $segment = (Get-Content -Raw $global:ClaudeUsageCachePath).Trim()
  }
  "PS $((Get-Location).Path)  $segment`n> "
}
```
