#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Root = 'C:\BeastTextV1',
    [ValidatePattern('^(latest|v?\d+\.\d+\.\d+)$')][string]$Version = 'latest',
    [string]$ReleaseDirectory,
    [switch]$CheckOnly,
    [switch]$DesktopShortcut,
    [switch]$Launch
)
$ErrorActionPreference = 'Stop'
$temporary = $null
try {
    if (-not $CheckOnly -and $env:OS -ne 'Windows_NT') { throw 'BeastText updates require Windows.' }
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $temporary = Join-Path ([IO.Path]::GetTempPath()) ('BeastText-update-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temporary | Out-Null
    $requested = $Version -replace '^v', ''
    $history = Join-Path $temporary 'CHANGELOG.md'
    $installer = Join-Path $temporary 'Install-BeastText.ps1'
    if ($ReleaseDirectory) {
        $ReleaseDirectory = [IO.Path]::GetFullPath($ReleaseDirectory)
        $metadata = Get-Content -LiteralPath (Join-Path $ReleaseDirectory 'release.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        $resolved = [string]$metadata.version
        if ($requested -ne 'latest' -and $requested -ne $resolved) { throw 'The offline release does not match the requested version.' }
        Copy-Item -LiteralPath (Join-Path $ReleaseDirectory 'CHANGELOG.md') -Destination $history
        Copy-Item -LiteralPath (Join-Path $ReleaseDirectory 'Install-BeastText.ps1') -Destination $installer
    } else {
        $headers = @{ 'User-Agent' = 'BeastText-Updater'; 'Accept' = 'application/vnd.github+json' }
        if ($requested -eq 'latest') {
            # Include the tested prereleases; GitHub's /releases/latest omits them.
            $releases = Invoke-RestMethod -Uri 'https://api.github.com/repos/NoLifeeSSJ/BeastText/releases?per_page=30' -Headers $headers
            $release = $releases | Where-Object {
                -not $_.draft -and $_.tag_name -match '^v\d+\.\d+\.\d+$' -and
                @($_.assets | Where-Object name -eq 'release.json').Count -gt 0 -and
                @($_.assets | Where-Object name -eq 'Install-BeastText.ps1').Count -gt 0
            } | Sort-Object { [System.Version](([string]$_.tag_name).Substring(1)) } -Descending | Select-Object -First 1
            if (-not $release) { throw 'No published BeastText Windows release was found.' }
            $resolved = ([string]$release.tag_name).Substring(1)
        } else { $resolved = $requested }
        $base = 'https://github.com/NoLifeeSSJ/BeastText/releases/download/v' + $resolved
        $manifestUrl = $base + '/release.json'
        $metadata = Invoke-RestMethod -Uri $manifestUrl -Headers @{ 'User-Agent' = 'BeastText-Updater' }
        Invoke-WebRequest -UseBasicParsing -Uri ($base + '/Install-BeastText.ps1') -OutFile $installer
        # The cumulative history also covers older releases that predate this updater.
        Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/NoLifeeSSJ/BeastText/main/docs/CHANGELOG.md' -OutFile $history
    }
    if ($resolved -notmatch '^\d+\.\d+\.\d+$' -or $metadata.version -ne $resolved -or
        $metadata.product -ne 'BeastText' -or $metadata.platform -ne 'win32' -or $metadata.arch -ne 'x64' -or
        $metadata.file -ne ('BeastText-' + $resolved + '-win-x64.zip') -or $metadata.sha256 -notmatch '^[a-fA-F0-9]{64}$') {
        throw 'The release metadata is invalid or does not match the selected Windows release.'
    }
    $changes = Get-Content -LiteralPath $history -Raw -Encoding UTF8
    if (-not $changes.Contains('## [' + $resolved + ']')) { throw 'The selected version is missing from the changelog.' }
    Write-Host ('BeastText version available: ' + $resolved)
    Write-Host $changes
    if ($CheckOnly) { Write-Host 'Check complete. No application files were changed.'; exit 0 }
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $installer, '-Root', $Root, '-NoLaunch')
    if ($DesktopShortcut) { $arguments += '-DesktopShortcut' }
    if ($ReleaseDirectory) { $arguments += @('-ReleaseDirectory', $ReleaseDirectory) }
    else { $arguments += @('-ManifestUrl', $manifestUrl) }
    & powershell.exe @arguments
    if ($LASTEXITCODE -ne 0) { throw 'The update did not complete. See the installer message and its temporary log for details.' }
    $application = Join-Path ([IO.Path]::GetFullPath($Root)) 'App'
    $marker = Get-Content -LiteralPath (Join-Path $application '.beasttext-install.json') -Raw | ConvertFrom-Json
    if ($marker.product -ne 'BeastText' -or $marker.version -ne $resolved) { throw 'The installed version could not be verified.' }
    $installedHistory = Join-Path $application 'docs\CHANGELOG.md'
    Copy-Item -LiteralPath $history -Destination $installedHistory -Force
    Write-Host ('Updated to BeastText ' + $resolved + '. Documents and settings were preserved.')
    Write-Host ('Full version history: ' + $installedHistory)
    if ($Launch) { Start-Process -FilePath (Join-Path $application 'BeastText.exe') -WorkingDirectory $application }
    exit 0
} catch {
    Write-Error -Message $_.Exception.Message -ErrorAction Continue
    exit 1
} finally {
    if ($temporary -and (Test-Path -LiteralPath $temporary)) { Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue }
}
