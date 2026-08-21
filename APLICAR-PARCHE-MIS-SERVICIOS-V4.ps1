# APLICAR-PARCHE-MIS-SERVICIOS-V4.ps1
# Monta MisServicios de forma robusta en App.jsx + DashboardLayout.jsx.
# - Soporta rutas absolutas y anidadas.
# - Soporta JSX en una o varias lineas.
# - Si el menu ya existe solo para tecnico, lo amplía a admin + tecnico.
# - Crea backup antes de tocar archivos.
# Ejecutar desde la raiz de Servicio-Tecnico.

$ErrorActionPreference = "Stop"

$root = Get-Location
$appPath = Join-Path $root "frontend\src\App.jsx"
$layoutPath = Join-Path $root "frontend\src\components\DashboardLayout.jsx"

if (-not (Test-Path $appPath)) { throw "No existe: $appPath" }
if (-not (Test-Path $layoutPath)) { throw "No existe: $layoutPath" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$appBackup = "$appPath.backup-$stamp"
$layoutBackup = "$layoutPath.backup-$stamp"
Copy-Item $appPath $appBackup -Force
Copy-Item $layoutPath $layoutBackup -Force
Write-Host "Backup App.jsx: $appBackup"
Write-Host "Backup DashboardLayout.jsx: $layoutBackup"

# ============================================================
# APP.JSX
# ============================================================
$appLines = [System.Collections.Generic.List[string]]::new()
foreach ($line in (Get-Content -Encoding UTF8 $appPath)) { $appLines.Add($line) }
$appText = $appLines -join "`n"

# 1) Import
if ($appText -notmatch "pages/Dashboard/MisServicios") {
    $importIndex = -1

    for ($i = 0; $i -lt $appLines.Count; $i++) {
        if ($appLines[$i] -match '^\s*import\s+DashboardLayout\s+from\s+') {
            $importIndex = $i
            break
        }
    }

    if ($importIndex -lt 0) {
        for ($i = 0; $i -lt $appLines.Count; $i++) {
            if ($appLines[$i] -match '^\s*import\s+') { $importIndex = $i }
        }
    }

    if ($importIndex -lt 0) {
        throw "No pude localizar un bloque de imports en App.jsx."
    }

    $appLines.Insert($importIndex + 1, "import MisServicios from './pages/Dashboard/MisServicios';")
}

$appText = $appLines -join "`n"

# 2) Ruta
$hasAbsoluteRoute = $appText -match 'path\s*=\s*["'']\/dashboard\/mis-servicios["'']'
$hasNestedRoute = $appText -match 'path\s*=\s*["'']mis-servicios["'']'

if (-not $hasAbsoluteRoute -and -not $hasNestedRoute) {
    $routeIndex = -1
    $routeEndIndex = -1
    $routeStyle = $null

    for ($i = 0; $i -lt $appLines.Count; $i++) {
        if ($appLines[$i] -match 'path\s*=\s*["''](\/dashboard\/)?servicios["'']') {
            $start = $i
            while ($start -ge 0 -and $appLines[$start] -notmatch '<Route\b') { $start-- }
            if ($start -lt 0 -or ($i - $start) -gt 12) { continue }

            $end = $i
            while ($end -lt $appLines.Count -and $appLines[$end] -notmatch '\/>\s*$') { $end++ }
            if ($end -ge $appLines.Count -or ($end - $i) -gt 12) { continue }

            $routeBlock = ($appLines[$start..$end] -join "`n")
            if ($routeBlock -notmatch '<Servicios\b') { continue }

            $routeIndex = $start
            $routeEndIndex = $end
            if ($routeBlock -match 'path\s*=\s*["'']\/dashboard\/servicios["'']') {
                $routeStyle = 'absolute'
            } else {
                $routeStyle = 'nested'
            }
            break
        }
    }

    # Fallback: Route y Servicios en una sola linea.
    if ($routeIndex -lt 0) {
        for ($i = 0; $i -lt $appLines.Count; $i++) {
            if ($appLines[$i] -match '<Route\b' -and $appLines[$i] -match '<Servicios\b') {
                $routeIndex = $i
                $routeEndIndex = $i
                if ($appLines[$i] -match 'path\s*=\s*["'']\/dashboard\/servicios["'']') {
                    $routeStyle = 'absolute'
                } elseif ($appLines[$i] -match 'path\s*=\s*["'']servicios["'']') {
                    $routeStyle = 'nested'
                }
                if ($routeStyle) { break }
            }
        }
    }

    if ($routeIndex -lt 0 -or -not $routeStyle) {
        throw "No pude localizar la ruta que renderiza Servicios en App.jsx."
    }

    $indent = ([regex]::Match($appLines[$routeIndex], '^\s*')).Value

    if ($routeStyle -eq 'absolute') {
        $newRoute = "${indent}<Route path=`"/dashboard/mis-servicios`" element={<MisServicios />} />"
    } else {
        $newRoute = "${indent}<Route path=`"mis-servicios`" element={<MisServicios />} />"
    }

    $appLines.Insert($routeEndIndex + 1, $newRoute)
}

Set-Content -Path $appPath -Value $appLines -Encoding UTF8

# ============================================================
# DASHBOARDLAYOUT.JSX
# ============================================================
$layoutLines = [System.Collections.Generic.List[string]]::new()
foreach ($line in (Get-Content -Encoding UTF8 $layoutPath)) { $layoutLines.Add($line) }
$layoutText = $layoutLines -join "`n"

# Si ya existe el bloque del parche anterior, ampliar tecnico -> admin + tecnico.
$layoutText = [regex]::Replace(
    $layoutText,
    '\(user\?\.role\?\.name\s*\|\|\s*user\?\.rol\)\s*===\s*[''"]tecnico[''"]',
    "['admin', 'tecnico'].includes(user?.role?.name || user?.rol)"
)

# Si el href todavía no existe, insertarlo en allNav.
if ($layoutText -notmatch '/dashboard/mis-servicios') {
    $layoutLines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in ($layoutText -split "`n")) { $layoutLines.Add($line) }

    $insertIndex = -1
    $insertIndent = '      '

    for ($i = 0; $i -lt $layoutLines.Count; $i++) {
        if ($layoutLines[$i] -match '^\s*const\s+allNav\s*=\s*\[') {
            $insertIndex = $i + 1
            $insertIndent = ([regex]::Match($layoutLines[$i], '^\s*')).Value + '  '
            break
        }
    }

    if ($insertIndex -lt 0) {
        throw "No pude localizar const allNav = [ en DashboardLayout.jsx."
    }

    $menuBlock = @(
        "${insertIndent}...(",
        "${insertIndent}  ['admin', 'tecnico'].includes(user?.role?.name || user?.rol)",
        "${insertIndent}    ? [",
        "${insertIndent}        {",
        "${insertIndent}          name: 'Mis servicios',",
        "${insertIndent}          href: '/dashboard/mis-servicios',",
        "${insertIndent}          icon: Wrench,",
        "${insertIndent}          permission: null,",
        "${insertIndent}        },",
        "${insertIndent}      ]",
        "${insertIndent}    : []",
        "${insertIndent}),"
    )

    for ($k = $menuBlock.Count - 1; $k -ge 0; $k--) {
        $layoutLines.Insert($insertIndex, $menuBlock[$k])
    }

    $layoutText = $layoutLines -join "`n"
}

# useMemo debe reaccionar a cambios de usuario/rol.
$layoutText = [regex]::Replace(
    $layoutText,
    '\},\s*\[\s*canViewModule\s*\]\s*\);',
    '}, [canViewModule, user]);',
    1
)

Set-Content -Path $layoutPath -Value $layoutText -Encoding UTF8

Write-Host ""
Write-Host "OK: MisServicios importado/ruta verificada en App.jsx."
Write-Host "OK: menu Mis servicios disponible para admin y tecnico."
Write-Host "OK: backups creados antes de modificar App.jsx y DashboardLayout.jsx."
Write-Host ""
Write-Host "Siguiente:"
Write-Host "  cd .\frontend"
Write-Host "  npm.cmd run build"
