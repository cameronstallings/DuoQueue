# Applies a migration file, defaulting to a DRY RUN that rolls back.
#
# Why not `supabase db push`: this repo's migration history has been repaired by hand
# before, and push is all-or-nothing across every unapplied file. This applies exactly
# one file, inside a transaction, and rolls back unless you explicitly pass -Commit —
# so you find out that a policy name collides or a constraint fails on existing rows
# BEFORE it half-applies.
#
#   .\scripts\db\apply-migration.ps1 supabase\migrations\0034_thing.sql
#   .\scripts\db\apply-migration.ps1 supabase\migrations\0034_thing.sql -Commit
#
# -Commit also records the version in supabase_migrations.schema_migrations, so the CLI's
# `migration list` stays in sync and a later `db push` doesn't try to re-apply it.
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Path,
  [switch]$Commit,
  [string]$ProjectRef = "oflexcazqfuvcikrewnb"
)

$file = Resolve-Path $Path
$sql = [System.IO.File]::ReadAllText($file)
$name = Split-Path $file -Leaf

# Migration files are named like 0034_photo_review_queue.sql
if ($name -notmatch '^(\d{4})_(.+)\.sql$') {
  throw "Expected a file named like 0034_some_name.sql, got '$name'"
}
$version = $Matches[1]
$label = $Matches[2]

$wrapped = if ($Commit) { "begin;`n$sql`ncommit;" } else { "begin;`n$sql`nrollback;" }

$token = & (Join-Path $PSScriptRoot "get-token.ps1")
$body = @{ query = $wrapped } | ConvertTo-Json -Depth 5

try {
  Invoke-RestMethod -Method Post `
    -Uri "https://api.supabase.com/v1/projects/$ProjectRef/database/query" `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json" -Body $body | Out-Null
} catch {
  Write-Output "MIGRATION FAILED (nothing was applied):"
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) { Write-Output $_.ErrorDetails.Message }
  else { Write-Output $_.Exception.Message }
  exit 1
}

if (-not $Commit) {
  Write-Output "DRY RUN OK - $name applies cleanly and was rolled back."
  Write-Output "Re-run with -Commit to apply it for real."
  exit 0
}

Write-Output "APPLIED $name"

$record = "insert into supabase_migrations.schema_migrations (version, name) values ('$version','$label') on conflict do nothing;"
& (Join-Path $PSScriptRoot "run-sql.ps1") -Query $record -ProjectRef $ProjectRef | Out-Null
Write-Output "Recorded version $version in schema_migrations."
