# Picks a random standup presenter.
# - Never picks the same person twice in a row, and cycles through everyone before repeating.
# - Always copies the message to the clipboard.
# - If SLACK_WEBHOOK_URL is set, also posts it to Slack.
#
# Usage:  .\standup-picker.ps1            (pick + copy / post)
#         .\standup-picker.ps1 -DryRun    (pick only, don't save state or post)
param([switch]$DryRun)

$dir     = $PSScriptRoot
$team    = (Get-Content "$dir\team.json" -Raw | ConvertFrom-Json).members
$stateFp = "$dir\.picker-state.json"

# Names already presented in the current round
$done = @()
if (Test-Path $stateFp) { $done = @((Get-Content $stateFp -Raw | ConvertFrom-Json).done) }

$pool = @($team | Where-Object { $done -notcontains $_.name })
if ($pool.Count -eq 0) {          # round finished, start a new one
    $done = @()
    $pool = @($team)
}

$pick    = $pool | Get-Random
$mention = if ($pick.slackId) { "<@$($pick.slackId)>" } else { "*$($pick.name)*" }
$text    = ":microphone: Today's standup presenter is $mention! :tada:"

if (-not $DryRun) {
    @{ done = @($done + $pick.name) } | ConvertTo-Json | Set-Content $stateFp
}

Write-Host $text
Set-Clipboard -Value $text
Write-Host "(copied to clipboard)"

if ($env:SLACK_WEBHOOK_URL -and -not $DryRun) {
    # Workflow Builder webhooks (/triggers/) take the variables you defined; classic incoming webhooks take "text"
    $payload = if ($env:SLACK_WEBHOOK_URL -match '/triggers/') { @{ presenter = $pick.name } } else { @{ text = $text } }
    $body = $payload | ConvertTo-Json
    Invoke-RestMethod -Uri $env:SLACK_WEBHOOK_URL -Method Post -ContentType 'application/json' -Body $body | Out-Null
    Write-Host "(posted to Slack)"
}
