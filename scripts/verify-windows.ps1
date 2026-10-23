# Run only in an isolated Windows acceptance runner. Does not claim physical-printer coverage.
#requires -Version 5.1
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$testRoot = Join-Path $env:TEMP ("BeastText's acceptance " + [Guid]::NewGuid().ToString('N'))
$data = Join-Path $env:APPDATA 'BeastText'
New-Item -ItemType Directory -Force -Path $testRoot, $data | Out-Null
$document = Join-Path $testRoot 'My original document.txt'
$sentinel = Join-Path $data ('acceptance-' + [Guid]::NewGuid().ToString('N') + '.txt')
[IO.File]::WriteAllText($document, 'preserve my document')
[IO.File]::WriteAllText($sentinel, 'preserve user data')
& powershell.exe -NoProfile -File (Join-Path $repo 'Install-BeastText.ps1') -Root $testRoot -ReleaseDirectory (Join-Path $repo 'release') -DesktopShortcut -NoLaunch
if ($LASTEXITCODE -ne 0) { throw 'Installation failed.' }
$exe = Join-Path $testRoot 'App\BeastText.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Installed executable missing.' }
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Programs')) 'BeastText.lnk'
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
$files = New-Object -ComObject Scripting.FileSystemObject
if ($files.GetFile($shortcut.TargetPath).ShortPath -ne $files.GetFile($exe).ShortPath) {
    throw "Start menu shortcut target '$($shortcut.TargetPath)' does not resolve to '$exe'."
}
if (-not (Get-AuthenticodeSignature -FilePath $exe)) { throw 'Executable could not be inspected.' }
& powershell.exe -NoProfile -File (Join-Path $repo 'Install-BeastText.ps1') -Root $testRoot -ReleaseDirectory (Join-Path $repo 'release') -NoLaunch
if ($LASTEXITCODE -ne 0) { throw 'Reinstallation failed.' }
if ((Get-Content -LiteralPath $document -Raw) -ne 'preserve my document' -or (Get-Content -LiteralPath $sentinel -Raw) -ne 'preserve user data') { throw 'Reinstallation did not preserve data.' }
& (Join-Path $testRoot 'App\Uninstall-BeastText.ps1') -Root $testRoot -Confirm:$false
if ($LASTEXITCODE -ne 0) { throw 'Uninstallation failed.' }
if (Test-Path -LiteralPath (Join-Path $testRoot 'App')) { throw 'Application directory remained after uninstall.' }
foreach ($folder in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) {
    if (Test-Path -LiteralPath (Join-Path $folder 'BeastText.lnk')) { throw 'An owned shortcut remained after uninstall.' }
}
if (-not (Test-Path -LiteralPath $document) -or -not (Test-Path -LiteralPath $sentinel)) { throw 'Uninstall removed user data.' }
Remove-Item -LiteralPath $sentinel
Remove-Item -LiteralPath $testRoot -Recurse -Force
Write-Host 'Windows installer acceptance passed. Packaged launch/IME and physical printing still need their separate checks.'
