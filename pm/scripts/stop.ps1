$ErrorActionPreference = "Stop"

$ContainerName = if ($env:PM_CONTAINER_NAME) { $env:PM_CONTAINER_NAME } else { "pm-mvp" }

$ExistingContainers = & docker ps --all --format "{{.Names}}"
if ($ExistingContainers -notcontains $ContainerName) {
    Write-Output "Container $ContainerName is not present."
    exit 0
}

$IsRunning = (& docker inspect --format "{{.State.Running}}" $ContainerName).Trim()
if ($IsRunning -eq "true") {
    & docker stop $ContainerName
    if ($LASTEXITCODE -ne 0) {
        throw "Docker container failed to stop."
    }
    Write-Output "Stopped $ContainerName."
} else {
    Write-Output "Container $ContainerName is already stopped."
}
