# APLICAR-PARCHE-MIS-SERVICIOS.ps1
# Ejecutar desde la raíz de Servicio-Tecnico.
# Modifica SOLO App.jsx y DashboardLayout.jsx.
# Crea backups antes de tocar ambos archivos.

$ErrorActionPreference = "Stop"

$root = Get-Location
$appPath = Join-Path $root "frontend\src\App.jsx"
$layoutPath = Join-Path $root "frontend\src\components\DashboardLayout.jsx"

if (-not (Test-Path $appPath)) {
    throw "No existe: $appPath"
}

if (-not (Test-Path $layoutPath)) {
    throw "No existe: $layoutPath"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

Copy-Item $appPath "$appPath.backup-$stamp" -Force
Copy-Item $layoutPath "$layoutPath.backup-$stamp" -Force

Write-Host "Backup App.jsx: $appPath.backup-$stamp"
Write-Host "Backup DashboardLayout.jsx: $layoutPath.backup-$stamp"

# ============================================================
# APP.JSX
# ============================================================

$appLines = [System.Collections.Generic.List[string]]::new()

foreach ($line in (Get-Content -Encoding UTF8 $appPath)) {
    $appLines.Add($line)
}

$appText = $appLines -join "`n"

if ($appText -notmatch "pages/Dashboard/MisServicios") {
    $importIndex = -1

    for ($i = 0; $i -lt $appLines.Count; $i++) {
        if ($appLines[$i] -match '^\s*import\s+DashboardLayout\s+from\s+') {
            $importIndex = $i
            break
        }
    }

    if ($importIndex -lt 0) {
        throw "No pude localizar el import de DashboardLayout en App.jsx."
    }

    $appLines.Insert(
        $importIndex + 1,
        "import MisServicios from './pages/Dashboard/MisServicios';"
    )
}

$appText = $appLines -join "`n"

if ($appText -notmatch 'path="/dashboard/mis-servicios"') {
    $routeIndex = -1

    for ($i = 0; $i -lt $appLines.Count; $i++) {
        if (
            $appLines[$i] -match 'path="/dashboard/servicios"' -and
            $appLines[$i] -match '<Servicios'
        ) {
            $routeIndex = $i
            break
        }
    }

    if ($routeIndex -lt 0) {
        throw "No pude localizar la ruta /dashboard/servicios en App.jsx."
    }

    $indentMatch = [regex]::Match($appLines[$routeIndex], '^\s*')
    $indent = $indentMatch.Value

    $appLines.Insert(
        $routeIndex + 1,
        "${indent}<Route path=""/dashboard/mis-servicios"" element={<MisServicios />} />"
    )
}

Set-Content -Path $appPath -Value $appLines -Encoding UTF8

# ============================================================
# DASHBOARDLAYOUT.JSX
# ============================================================

$layout = Get-Content -Raw -Encoding UTF8 $layoutPath

if ($layout -notmatch "/dashboard/mis-servicios") {
    $needle = "const allNav = ["
    $index = $layout.IndexOf($needle)

    if ($index -lt 0) {
        throw "No pude localizar 'const allNav = [' en DashboardLayout.jsx."
    }

    $insertAt = $index + $needle.Length

    $menuBlock = @"

      ...(
        (user?.role?.name || user?.rol) === 'tecnico'
          ? [
              {
                name: 'Mis servicios',
                href: '/dashboard/mis-servicios',
                icon: Wrench,
                permission: null,
              },
            ]
          : []
      ),
"@

    $layout = $layout.Insert($insertAt, $menuBlock)
}

# El useMemo ahora depende también del usuario porque el enlace
# "Mis servicios" solo existe para el rol técnico.
if (
    $layout.Contains("}, [canViewModule]);") -and
    -not $layout.Contains("}, [canViewModule, user]);")
) {
    $layout = $layout.Replace(
        "}, [canViewModule]);",
        "}, [canViewModule, user]);"
    )
}

Set-Content -Path $layoutPath -Value $layout -Encoding UTF8

Write-Host ""
Write-Host "OK: se agregó /dashboard/mis-servicios."
Write-Host "OK: el menú Mis servicios solo aparece para el rol tecnico."
Write-Host "OK: los backups quedaron junto a cada archivo."
