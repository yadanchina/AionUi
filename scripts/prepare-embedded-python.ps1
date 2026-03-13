param(
  [string]$PythonVersion = '3.11.9',
  [string]$Arch = 'amd64'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$runtimeDir = Join-Path $repoRoot 'resources\python'
$requirementsFile = Join-Path $repoRoot 'scripts\voice\requirements.txt'
$tempDir = Join-Path $repoRoot '.tmp\python-runtime'
$embedZip = Join-Path $tempDir "python-$PythonVersion-embed-$Arch.zip"
$getPipPath = Join-Path $tempDir 'get-pip.py'
$pythonUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-$Arch.zip"
$getPipUrl = 'https://bootstrap.pypa.io/get-pip.py'

function Invoke-CheckedCommand {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
  }
}

Write-Host "[python-runtime] Preparing embedded Python $PythonVersion ($Arch)"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

if (Test-Path $runtimeDir) {
  Write-Host "[python-runtime] Cleaning existing runtime: $runtimeDir"
  Get-ChildItem -Path $runtimeDir -Force | Remove-Item -Force -Recurse
} else {
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
}

Write-Host "[python-runtime] Downloading embeddable package..."
Invoke-WebRequest -Uri $pythonUrl -OutFile $embedZip

Write-Host "[python-runtime] Extracting runtime..."
Expand-Archive -Path $embedZip -DestinationPath $runtimeDir -Force

$pthFile = Get-ChildItem -Path $runtimeDir -Filter 'python*._pth' | Select-Object -First 1
if (-not $pthFile) {
  throw "python*._pth not found in $runtimeDir"
}

$pthLines = Get-Content -Path $pthFile.FullName
$pthLines = $pthLines | Where-Object { $_ -notmatch '^\s*#?\s*import\s+site\s*$' }
$pthLines += 'Lib\site-packages'
$pthLines += 'import site'
$pthLines = $pthLines | Select-Object -Unique
Set-Content -Path $pthFile.FullName -Value $pthLines -Encoding Ascii

Write-Host "[python-runtime] Downloading get-pip.py..."
Invoke-WebRequest -Uri $getPipUrl -OutFile $getPipPath

$pythonExe = Join-Path $runtimeDir 'python.exe'
if (-not (Test-Path $pythonExe)) {
  throw "python.exe not found in $runtimeDir"
}

Write-Host "[python-runtime] Installing pip..."
Invoke-CheckedCommand -FilePath $pythonExe -Arguments @($getPipPath, '--no-warn-script-location')

Write-Host "[python-runtime] Upgrading pip..."
Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('-m', 'pip', 'install', '--upgrade', 'pip', '--no-warn-script-location')

$sitePackagesDir = Join-Path $runtimeDir 'Lib\site-packages'
New-Item -ItemType Directory -Force -Path $sitePackagesDir | Out-Null

Write-Host "[python-runtime] Installing requirements into embedded runtime..."
Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('-m', 'pip', 'install', '--no-warn-script-location', '--target', $sitePackagesDir, '-r', $requirementsFile)

Write-Host "[python-runtime] Verifying imports..."
Invoke-CheckedCommand -FilePath $pythonExe -Arguments @('-c', "import vosk, sounddevice; print('ok')")

Write-Host "[python-runtime] Done: $runtimeDir"
