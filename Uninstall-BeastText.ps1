#requires -Version 5.1
[CmdletBinding(SupportsShouldProcess=$true, ConfirmImpact='High')]
param([string]$Root = 'C:\BeastTextV1', [switch]$RemoveUserData)
$ErrorActionPreference = 'Stop'
try {
    $target = Join-Path ([IO.Path]::GetFullPath($Root)) 'App'
    $marker = Join-Path $target '.beasttext-install.json'
    if (-not (Test-Path -LiteralPath $marker) -or (Get-Content -LiteralPath $marker -Raw | ConvertFrom-Json).product -ne 'BeastText') { throw 'No recognised BeastText installation at this root. No files were removed.' }
    if (Get-Process -Name BeastText -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($target + '\', [StringComparison]::OrdinalIgnoreCase) }) { throw 'Close BeastText before uninstalling.' }
    if ($PSCmdlet.ShouldProcess($target, 'Remove BeastText application and its shortcuts; preserve documents')) {
        Remove-Item -LiteralPath $target -Recurse -Force
        foreach ($folder in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) {
            $shortcutPath = Join-Path $folder 'BeastText.lnk'
            if (Test-Path -LiteralPath $shortcutPath) {
                $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
                if ($shortcut.TargetPath.StartsWith($target + '\', [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $shortcutPath }
            }
        }
        $classes = 'HKCU:\Software\Classes'
        $commandPath = $classes + '\BeastText.Document\shell\open\command'
        if ((Test-Path $commandPath) -and (Get-Item $commandPath).GetValue('').Contains($target)) {
            Remove-Item ($classes + '\BeastText.Document') -Recurse -Force
            $ext = $classes + '\.beasttext'
            if ((Test-Path $ext) -and (Get-Item $ext).GetValue('') -eq 'BeastText.Document') { (Get-Item $ext).DeleteValue('') }
            Remove-ItemProperty ($ext + '\OpenWithProgids') -Name 'BeastText.Document' -ErrorAction SilentlyContinue
        }
        if ($RemoveUserData) {
            $data = Join-Path $env:APPDATA 'BeastText'
            if ($PSCmdlet.ShouldProcess($data, 'Permanently remove settings, recovery, backups, dictionary and templates')) { Remove-Item -LiteralPath $data -Recurse -Force -ErrorAction SilentlyContinue }
        }
        Write-Host 'BeastText uninstalled. Your documents and source files were preserved.'
    }
    exit 0
} catch { Write-Error $_.Exception.Message; exit 1 }
