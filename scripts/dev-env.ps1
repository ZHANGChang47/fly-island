# Local MSVC build environment for fly-island on Windows.
#
# Why this exists
# ---------------
# The Rust code needs a C compiler and a resource compiler:
#   * `ring` (via cc-rs) needs cl.exe
#   * `tauri-winres`/`embed-resource` needs rc.exe on the MSVC target
# The default user shell does not expose the Visual Studio build tools, so
# `pnpm tauri dev` / `pnpm tauri build` would otherwise fail with
# "failed to find tool gcc.exe" or "NotAttempted(windres)".
#
# This repo pins `channel = "1.99.1"` (no host) in rust-toolchain.toml, which
# resolves to the gnu host on this machine. A directory-level rustup override
# pins this folder to the msvc host toolchain (see `rustup override list`).
# This script adds the matching MSVC cl.exe/rc.exe and SDK paths to the
# environment for the current PowerShell session.
#
# Usage
# -----
#   . .\scripts\dev-env.ps1          # dot-source into current session, then:
#   pnpm tauri dev
#   pnpm tauri build --no-bundle
#
# It is safe to dot-source more than once (paths are de-duplicated).

# --- Locations (adjust here if VS / SDK are installed elsewhere) -----------
$vsRoot = "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools"
$msvcDir = Get-ChildItem (Join-Path $vsRoot "VC\Tools\MSVC") -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1 -ExpandProperty FullName
$sdkRoot = "C:\Program Files (x86)\Windows Kits\10"
$sdkVer = Get-ChildItem (Join-Path $sdkRoot "Include") -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1 -ExpandProperty Name

if (-not $msvcDir) { throw "MSVC toolchain not found under $vsRoot\VC\Tools\MSVC" }
if (-not $sdkVer) { throw "Windows SDK not found under $sdkRoot\Include" }

$sdkBin = Join-Path $sdkRoot "bin\$sdkVer\x64"
$msvcBin = Join-Path $msvcDir "bin\Hostx64\x64"

# --- Prepend to PATH, de-duplicated ----------------------------------------
$newPaths = @($msvcBin, $sdkBin, "$env:USERPROFILE\.cargo\bin")
foreach ($p in $newPaths) {
    if (($env:PATH -split ";") -notcontains $p) {
        $env:PATH = "$p;$env:PATH"
    }
}

# --- C/C++ toolchain + SDK include/lib -------------------------------------
$env:CC = "cl.exe"
$env:CXX = "cl.exe"
$include = @(
    (Join-Path $msvcDir "include"),
    (Join-Path $sdkRoot "Include\$sdkVer\um"),
    (Join-Path $sdkRoot "Include\$sdkVer\ucrt"),
    (Join-Path $sdkRoot "Include\$sdkVer\shared"),
    (Join-Path $sdkRoot "Include\$sdkVer\winrt"),
    (Join-Path $sdkRoot "Include\$sdkVer\cppwinrt")
)
$lib = @(
    (Join-Path $msvcDir "lib\x64"),
    (Join-Path $sdkRoot "Lib\$sdkVer\um\x64"),
    (Join-Path $sdkRoot "Lib\$sdkVer\ucrt\x64")
)
$env:INCLUDE = ($include -join ";") + ";" + $env:INCLUDE
$env:LIB = ($lib -join ";") + ";" + $env:LIB

# --- Toolchain override for this directory ---------------------------------
$env:RUSTUP_TOOLCHAIN = "1.99.1-x86_64-pc-windows-msvc"

# Keep parallel C compilation low: this machine has ~16 GB RAM but little free
# headroom, and the default job count once stalled cl.exe on zstd's C sources.
if (-not $env:CARGO_BUILD_JOBS) { $env:CARGO_BUILD_JOBS = "2" }

Write-Host "[fly-island] MSVC build environment loaded." -ForegroundColor Green
Write-Host "  MSVC : $msvcDir" -ForegroundColor Gray
Write-Host "  SDK  : $sdkVer" -ForegroundColor Gray
Write-Host "  cl   : $((Get-Command cl.exe -ErrorAction SilentlyContinue).Source)" -ForegroundColor Gray
Write-Host "  rc   : $((Get-Command rc.exe -ErrorAction SilentlyContinue).Source)" -ForegroundColor Gray
Write-Host "  jobs : $env:CARGO_BUILD_JOBS" -ForegroundColor Gray
Write-Host "Tip: dependencies are already cached; export CARGO_NET_OFFLINE=true to avoid" -ForegroundColor DarkGray
Write-Host("     the local proxy stalling build-script downloads.") -ForegroundColor DarkGray
