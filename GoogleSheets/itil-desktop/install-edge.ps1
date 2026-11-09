param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[a-p]{32}$')]
    [string]$ExtensionId,

    [string]$AgentDesktopPath
)

$ErrorActionPreference = 'Stop'
$nodePath = (Get-Command node.exe -CommandType Application).Source
if (-not $AgentDesktopPath) {
    $npm = (Get-Command npm.cmd -CommandType Application).Source
    $npmRoot = & $npm root -g
    if ($LASTEXITCODE -ne 0) { throw 'npm root -g failed' }
    $arch = & $nodePath -p process.arch
    $AgentDesktopPath = Join-Path $npmRoot "agent-desktop\bin\agent-desktop-win32-$arch.exe"
}
$agent = Get-Item -LiteralPath $AgentDesktopPath
if ($agent.PSIsContainer -or $agent.Extension -ne '.exe') {
    throw 'AgentDesktopPath must point to the native agent-desktop executable'
}

$hostName = 'ru.duplicate_marker.itil_desktop'
$directory = Join-Path $env:LOCALAPPDATA 'DuplicateMarker\ItilDesktop'
$null = New-Item -ItemType Directory -Path $directory -Force
$launcher = Join-Path $directory 'itil-desktop.exe'
$compiler = Join-Path ([Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) 'csc.exe'
if (-not (Test-Path -LiteralPath $compiler -PathType Leaf)) {
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
}
& $compiler /nologo /target:winexe /codepage:65001 "/out:$launcher" (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Native Messaging launcher compilation failed' }

Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'host.cjs') -Destination $directory -Force
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $directory 'node-path.txt'), $nodePath, $utf8)
[IO.File]::WriteAllText((Join-Path $directory 'agent-path.txt'), $agent.FullName, $utf8)
$manifest = @{
    name = $hostName
    description = 'Local 1C:ITIL lookup for Duplicate Marker'
    path = $launcher
    type = 'stdio'
    allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json
$manifestPath = Join-Path $directory 'manifest.json'
[IO.File]::WriteAllText($manifestPath, $manifest, $utf8)

$registryKey = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$hostName"
$null = New-Item -Path $registryKey -Force
Set-Item -LiteralPath $registryKey -Value $manifestPath
Write-Output $manifestPath
