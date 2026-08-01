# Runs SQL against the hosted Supabase project via the Management API.
#
# There is no psql on this machine and no stored DB password, but the Supabase CLI is
# logged in — so the Management API's query endpoint is the way in. Handy for reading
# grants, policies, and row counts without opening the dashboard.
#
#   .\scripts\db\run-sql.ps1 -Query "select count(*) from public.profiles"
#   .\scripts\db\run-sql.ps1 -QueryFile .\some-query.sql
param(
  [string]$Query,
  [string]$QueryFile,
  [string]$ProjectRef = "oflexcazqfuvcikrewnb"
)

if ($QueryFile) { $Query = [System.IO.File]::ReadAllText((Resolve-Path $QueryFile)) }
if (-not $Query) { throw "Provide -Query or -QueryFile" }

$token = & (Join-Path $PSScriptRoot "get-token.ps1")
$body = @{ query = $Query } | ConvertTo-Json -Depth 5

try {
  $resp = Invoke-RestMethod -Method Post `
    -Uri "https://api.supabase.com/v1/projects/$ProjectRef/database/query" `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json" -Body $body
  $resp | ConvertTo-Json -Depth 10
} catch {
  Write-Output "QUERY FAILED:"
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) { Write-Output $_.ErrorDetails.Message }
  else { Write-Output $_.Exception.Message }
  exit 1
}
