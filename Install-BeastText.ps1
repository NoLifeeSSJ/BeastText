#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Root = 'C:\BeastTextV1',
    [string]$ReleaseDirectory,
    [Uri]$ManifestUrl,
    [switch]$DesktopShortcut,
    [switch]$AssociateNative,
    [switch]$Launch,
    [switch]$NoLaunch
)
$ErrorActionPreference = 'Stop'
if (-not $ReleaseDirectory) {
    if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'release.json')) { $ReleaseDirectory = $PSScriptRoot }
    else { $ReleaseDirectory = Join-Path $PSScriptRoot 'release' }
}
$ProgressPreference = 'Continue'
$exitCode = 1
$stage = $null
$previous = $null
$target = $null
$log = Join-Path $env:TEMP ('BeastText-install-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
function Write-Status([string]$Text) {
    Write-Host $Text
    Add-Content -LiteralPath $log -Value ((Get-Date -Format o) + ' ' + $Text)
}
try {
    if ($env:OS -ne 'Windows_NT') { throw 'BeastText requires Windows 10 or Windows 11.' }
    if ([Environment]::OSVersion.Version.Build -lt 19045) { throw 'This release supports Windows 10 22H2 (build 19045) or newer.' }
    $arch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    if ($arch -ne 'AMD64') { throw 'This package is for x64 Windows. ARM64 and 32-bit packages are not included.' }
    $Root = [IO.Path]::GetFullPath($Root)
    $target = Join-Path $Root 'App'
    Write-Status ('Installing BeastText in ' + $target)
    Write-Status ('Installation log: ' + $log)
    New-Item -ItemType Directory -Force -Path $Root | Out-Null
    # Windows shortcuts and process paths expand 8.3 names (for example RUNNER~1).
    # Use the same long path for ownership checks, shortcuts and registry entries.
    if (-not ('BeastTextPaths' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class BeastTextPaths {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern uint GetLongPathName(string path, StringBuilder result, uint capacity);
}
'@
    }
    $longRoot = New-Object Text.StringBuilder 32768
    $longLength = [BeastTextPaths]::GetLongPathName($Root, $longRoot, $longRoot.Capacity)
    if ($longLength -eq 0 -or $longLength -ge $longRoot.Capacity) { throw 'Cannot resolve the installation folder.' }
    $Root = $longRoot.ToString()
    $target = Join-Path $Root 'App'
    $probe = Join-Path $Root ('.write-test-' + [Guid]::NewGuid().ToString('N'))
    try { [IO.File]::WriteAllText($probe, 'test'); Remove-Item -LiteralPath $probe }
    catch { throw ('Cannot write to ' + $Root + '. Choose a writable folder with -Root. Administrator access is not normally required.') }
    $downloadDir = $null
    if ($ManifestUrl) {
        if ($ManifestUrl.Scheme -ne 'https') { throw 'Release metadata must use HTTPS.' }
        Write-Status ('Downloading release metadata from ' + $ManifestUrl.AbsoluteUri)
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $downloadDir = Join-Path $env:TEMP ('BeastText-download-' + [Guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $downloadDir | Out-Null
        $metadataPath = Join-Path $downloadDir 'release.json'
        Invoke-WebRequest -UseBasicParsing -Uri $ManifestUrl -OutFile $metadataPath
    } else { $metadataPath = Join-Path $ReleaseDirectory 'release.json' }
    if (-not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) { throw 'release\release.json is missing. Keep the installer beside a built release folder, or supply -ReleaseDirectory.' }
    $metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
    if ($metadata.product -ne 'BeastText' -or $metadata.platform -ne 'win32' -or $metadata.arch -ne 'x64') { throw 'Release metadata does not describe a BeastText x64 Windows release.' }
    if ($metadata.file -notmatch '^BeastText-[A-Za-z0-9.-]+-win-x64\.zip$' -or $metadata.sha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'Release metadata has an unsafe filename or invalid SHA-256.' }
    if ($ManifestUrl) {
        $archive = Join-Path $downloadDir $metadata.file
        $archiveUrl = [Uri]::new($ManifestUrl, [string]$metadata.file)
        if ($archiveUrl.Scheme -ne 'https' -or $archiveUrl.Host -ne $ManifestUrl.Host) { throw 'Archive download must stay on the HTTPS release host.' }
        Write-Status ('Downloading self-contained BeastText ' + $metadata.version + '. No developer tools or separate runtime are needed.')
        Invoke-WebRequest -UseBasicParsing -Uri $archiveUrl -OutFile $archive
    } else { $archive = Join-Path $ReleaseDirectory $metadata.file }
    if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) { throw ('Release archive is missing: ' + $archive) }
    Write-Progress -Activity 'Installing BeastText' -Status 'Verifying release archive' -PercentComplete 25
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $metadata.sha256) { throw 'Release checksum failed. The installed application has not been changed.' }
    if ((Get-Item -LiteralPath $archive).Length -ne $metadata.size) { throw 'Release size does not match the metadata.' }
    if (Test-Path -LiteralPath $target) {
        $markerPath = Join-Path $target '.beasttext-install.json'
        if (-not (Test-Path -LiteralPath $markerPath)) { throw 'The App folder already exists without a BeastText installation marker. Choose another root; existing files will not be overwritten.' }
        $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
        if ($marker.product -ne 'BeastText') { throw 'The App directory is not a recognised BeastText installation.' }
        $running = Get-Process -Name BeastText -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($target + '\', [StringComparison]::OrdinalIgnoreCase) }
        if ($running) { throw 'Close BeastText before reinstalling. Unsaved work will not be terminated.' }
    }
    $stage = Join-Path $Root ('.BeastText-stage-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stage | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
        $total = 0L
        foreach ($entry in $zip.Entries) {
            $total += $entry.Length
            $full = [IO.Path]::GetFullPath((Join-Path $stage $entry.FullName))
            if (-not $full.StartsWith($stage + '\', [StringComparison]::OrdinalIgnoreCase) -or $entry.FullName.Contains(':') -or (($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) { throw 'The release archive contains an unsafe entry.' }
            if ($total -gt 1500000000 -or $entry.Length -gt 700000000) { throw 'The release archive exceeds safe extraction limits.' }
        }
    } finally { $zip.Dispose() }
    Write-Progress -Activity 'Installing BeastText' -Status 'Extracting verified application' -PercentComplete 55
    [IO.Compression.ZipFile]::ExtractToDirectory($archive, $stage)
    if (-not (Test-Path -LiteralPath (Join-Path $stage 'BeastText.exe'))) { throw 'The release archive does not contain BeastText.exe.' }
    if (-not (Test-Path -LiteralPath (Join-Path $stage 'resources\app.asar'))) { throw 'The application resources are missing.' }
    @{product='BeastText'; version=$metadata.version; installed=(Get-Date -Format o)} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stage '.beasttext-install.json') -Encoding UTF8
    $uninstallTarget = Join-Path $stage 'Uninstall-BeastText.ps1'
    if (-not (Test-Path -LiteralPath $uninstallTarget)) { throw 'The release is missing its uninstall mechanism.' }
    if (Test-Path -LiteralPath $target) {
        $previous = Join-Path $Root ('.BeastText-previous-' + [Guid]::NewGuid().ToString('N'))
        Move-Item -LiteralPath $target -Destination $previous
    }
    try {
        Move-Item -LiteralPath $stage -Destination $target
        $stage = $null
        Write-Progress -Activity 'Installing BeastText' -Status 'Creating shortcuts' -PercentComplete 85
        $wsh = New-Object -ComObject WScript.Shell
        $startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'BeastText.lnk'
        $shortcutPaths = @($startMenu)
        if ($DesktopShortcut) { $shortcutPaths += Join-Path ([Environment]::GetFolderPath('Desktop')) 'BeastText.lnk' }
        foreach ($shortcutPath in $shortcutPaths) {
            $shortcut = $wsh.CreateShortcut($shortcutPath)
            $shortcut.TargetPath = Join-Path $target 'BeastText.exe'
            $shortcut.WorkingDirectory = $target
            $shortcut.Description = 'BeastText document editor'
            $icon = Join-Path $target 'resources\app.asar.unpacked\resources\beasttext.ico'
            if (Test-Path -LiteralPath $icon) { $shortcut.IconLocation = $icon } else { $shortcut.IconLocation = $shortcut.TargetPath }
            $shortcut.Save()
        }
        if ($AssociateNative) {
            $classes = 'HKCU:\Software\Classes'
            New-Item -Path ($classes + '\BeastText.Document\shell\open\command') -Force | Out-Null
            Set-Item -Path ($classes + '\BeastText.Document') -Value 'BeastText document'
            Set-Item -Path ($classes + '\BeastText.Document\shell\open\command') -Value ('"' + (Join-Path $target 'BeastText.exe') + '" "%1"')
            New-Item -Path ($classes + '\.beasttext\OpenWithProgids') -Force | Out-Null
            New-ItemProperty -Path ($classes + '\.beasttext\OpenWithProgids') -Name 'BeastText.Document' -Value '' -PropertyType String -Force | Out-Null
            $current = (Get-Item -Path ($classes + '\.beasttext')).GetValue('')
            if (-not $current) { Set-Item -Path ($classes + '\.beasttext') -Value 'BeastText.Document' }
        }
    } catch {
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
        if ($previous -and (Test-Path -LiteralPath $previous)) { Move-Item -LiteralPath $previous -Destination $target; $previous = $null }
        throw
    }
    if ($previous) { Remove-Item -LiteralPath $previous -Recurse -Force; $previous = $null }
    Write-Progress -Activity 'Installing BeastText' -Completed
    Write-Status ('BeastText ' + $metadata.version + ' installed successfully. Settings and documents have been preserved.')
    if (-not $NoLaunch -and ($Launch -or [Environment]::UserInteractive)) {
        $doLaunch = $Launch -or ((Read-Host 'Open BeastText now? [Y/n]') -notmatch '^[nN]')
        if ($doLaunch) { Start-Process -FilePath (Join-Path $target 'BeastText.exe') -WorkingDirectory $target }
    }
    $exitCode = 0
} catch {
    Write-Status ('Installation failed: ' + $_.Exception.Message)
    Write-Error -Message $_.Exception.Message -ErrorAction Continue
} finally {
    if ($stage -and (Test-Path -LiteralPath $stage)) { Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue }
    if ($downloadDir -and (Test-Path -LiteralPath $downloadDir)) { Remove-Item -LiteralPath $downloadDir -Recurse -Force -ErrorAction SilentlyContinue }
}
exit $exitCode
