$ErrorActionPreference = "Stop"

$ProjectPath = Split-Path -Parent $PSScriptRoot
$ImageName = if ($env:PM_IMAGE_NAME) { $env:PM_IMAGE_NAME } else { "pm-mvp:local" }
$ContainerName = if ($env:PM_CONTAINER_NAME) { $env:PM_CONTAINER_NAME } else { "pm-mvp" }
$Port = if ($env:PM_PORT) { $env:PM_PORT } else { "8000" }
$VolumeName = if ($env:PM_VOLUME_NAME) { $env:PM_VOLUME_NAME } else { "pm-mvp-data" }

$ExistingContainers = & docker ps --all --format "{{.Names}}"
if ($ExistingContainers -contains $ContainerName) {
    throw "Container $ContainerName already exists. Run scripts/stop.ps1 first."
}

& docker build --tag $ImageName $ProjectPath
if ($LASTEXITCODE -ne 0) {
    throw "Docker image build failed."
}

$RunArguments = @(
    "run",
    "--rm",
    "--detach",
    "--name", $ContainerName,
    "--publish", "${Port}:8000",
    "--volume", "${VolumeName}:/app/backend/data"
)

$EnvFile = Join-Path $ProjectPath "backend\.env"
if (Test-Path -LiteralPath $EnvFile) {
    $RunArguments += @("--env-file", $EnvFile)
}

$RunArguments += $ImageName
& docker @RunArguments
if ($LASTEXITCODE -ne 0) {
    throw "Docker container failed to start."
}

Write-Output "Project Management MVP is running at http://localhost:$Port"
