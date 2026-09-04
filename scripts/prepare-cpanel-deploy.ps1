#Requires -Version 5.1
<#
.SYNOPSIS
  Build the FMS static site for cPanel upload (File Manager only - no server terminal).

.EXAMPLE
  # Same host as API (API at /api - combined Laravel deploy or same domain)
  .\scripts\prepare-cpanel-deploy.ps1 -SingleHost "https://iposb.strataaiops.com"

.EXAMPLE
  # FMS and API on different URLs
  .\scripts\prepare-cpanel-deploy.ps1 `
    -FmsUrl "https://iposb.strataaiops.com" `
    -ApiUrl "https://api.iposb.strataaiops.com"

.EXAMPLE
  # Build only (env already in .env.production.local)
  .\scripts\prepare-cpanel-deploy.ps1 -UseEnvFile -Zip
#>
param(
    [string] $SingleHost,
    [string] $FmsUrl,
    [string] $ApiUrl,

    [string] $OutDir = (Join-Path $PSScriptRoot "..\deploy\cpanel\fms"),
    [switch] $UseEnvFile,
    [switch] $SkipInstall,
    [switch] $Zip
)

$ErrorActionPreference = "Stop"
$WebRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

if (-not $UseEnvFile) {
    if ($SingleHost) {
        $SingleHost = $SingleHost.TrimEnd("/")
        $FmsUrl = $SingleHost
        $viteApiUrl = "/api"
    }
    elseif ($FmsUrl -and $ApiUrl) {
        $FmsUrl = $FmsUrl.TrimEnd("/")
        $ApiUrl = $ApiUrl.TrimEnd("/")
        $viteApiUrl = "$ApiUrl/api"
    }
    else {
        throw "Provide -SingleHost, or both -FmsUrl and -ApiUrl, or -UseEnvFile (with .env.production.local)."
    }
}

Write-Host "IPOSB FMS cPanel deploy prep" -ForegroundColor Cyan
if ($FmsUrl) {
    Write-Host "  FMS URL: $FmsUrl"
}
if (-not $UseEnvFile) {
    Write-Host "  VITE_API_URL: $viteApiUrl"
}
Write-Host ""

Push-Location $WebRoot
try {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm not found in PATH."
    }

    if (-not $SkipInstall) {
        Write-Host "[1/2] npm install..." -ForegroundColor Yellow
        if (Test-Path "package-lock.json") {
            npm ci
            if ($LASTEXITCODE -ne 0) {
                throw "npm ci failed. Close apps locking node_modules or use -SkipInstall."
            }
        }
        else {
            npm install
            if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
        }
    }
    else {
        Write-Host "[1/2] Skipping npm install (-SkipInstall)" -ForegroundColor DarkGray
    }

    Write-Host "[2/2] npm run build..." -ForegroundColor Yellow
    if (-not $UseEnvFile) {
        $env:VITE_API_URL = $viteApiUrl
        if ($ApiUrl) {
            $env:VITE_API_ORIGIN = $ApiUrl
        }
        elseif ($SingleHost) {
            $env:VITE_API_ORIGIN = $SingleHost
        }
        if (-not $env:VITE_DISPATCH_KEY) {
            Write-Host "  Tip: set VITE_DISPATCH_KEY to match API DISPATCH_API_KEY." -ForegroundColor DarkYellow
        }
    }

    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build failed."
    }
    if (-not (Test-Path "dist\index.html")) {
        throw "Build failed: dist\index.html missing."
    }
    if (-not (Test-Path "dist\.htaccess")) {
        Write-Host "  Warning: dist\.htaccess missing - SPA routes may 404 on refresh." -ForegroundColor DarkYellow
    }
}
finally {
    Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
    Remove-Item Env:VITE_API_ORIGIN -ErrorAction SilentlyContinue
    Pop-Location
}

$fmsOut = Join-Path $WebRoot "deploy\cpanel\fms"
$deployRoot = Join-Path $WebRoot "deploy\cpanel"
if (Test-Path $fmsOut) {
    Remove-Item $fmsOut -Recurse -Force
}
New-Item -ItemType Directory -Path $fmsOut -Force | Out-Null
Copy-Item -Path (Join-Path $WebRoot "dist\*") -Destination $fmsOut -Recurse -Force

$apiNote = if ($UseEnvFile) { "(from .env.production.local)" } elseif ($viteApiUrl -eq "/api") { "$FmsUrl/api" } else { $viteApiUrl }
$generatedAt = Get-Date -Format "yyyy-MM-dd HH:mm"

$checklist = @(
    "IPOSB FMS cPanel upload checklist"
    "Generated: $generatedAt"
    ""
    "FMS URL:  $FmsUrl"
    "API URL:  $apiNote"
    "Package:  deploy/cpanel/fms/"
    ""
    "=== cPanel File Manager (no terminal) ==="
    "* Upload ALL contents of deploy/cpanel/fms/ to the FMS document root"
    "* Confirm .htaccess is present (required for React Router)"
    "* Enable SSL (AutoSSL)"
    ""
    "=== Verify ==="
    "* Open FMS URL - login page loads"
    "* Log in (admin / admin123 if demo users exist on API)"
    "* Browser DevTools Network - API calls succeed"
    ""
    "Notes:"
    "* Static files only. Laravel API must already be deployed."
    "* First-time full deploy: use iposb-api prepare-cpanel-deploy.ps1 -SingleHost"
    ""
    "See docs/CPANEL_DEPLOYMENT.md"
) -join "`n"

Set-Content -Path (Join-Path $deployRoot "UPLOAD_CHECKLIST.txt") -Value $checklist -Encoding UTF8

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "  FMS package: $fmsOut"
Write-Host "  Checklist:   $(Join-Path $deployRoot 'UPLOAD_CHECKLIST.txt')"

if ($Zip) {
    $zipPath = Join-Path $WebRoot "deploy\cpanel-fms-$(Get-Date -Format 'yyyyMMdd-HHmm').zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path (Join-Path $deployRoot "*") -DestinationPath $zipPath
    Write-Host "  Zip: $zipPath" -ForegroundColor Green
}
