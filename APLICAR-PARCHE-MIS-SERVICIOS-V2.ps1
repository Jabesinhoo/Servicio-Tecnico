# APLICAR-PARCHE-MIS-SERVICIOS-V2.ps1
# Hotfix robusto para App.jsx + DashboardLayout.jsx.
# Soporta rutas absolutas (/dashboard/servicios) y rutas anidadas (servicios).
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
        # Fallback: insertar tras el ultimo import real.
        for ($i = 0; $i -lt $appLines.Count; $i++) {
            if ($appLines[$i] -match '^\s*import\s+') { $importIndex = $i }
        }
    }

    if ($importIndex -lt 0) {
        throw "No pude localizar un bloque de imports en App.jsx. No se modifico el archivo."
    }

    $appLines.Insert($importIndex + 1, "import MisServicios from './pages/Dashboard/MisServicios';")
}

$appText = $appLines -join "`n"

# 2) Ruta. Detectar si ya existe en cualquiera de las dos formas.
$hasAbsoluteRoute = $appText -match 'path\s*=\s*["'']\/dashboard\/mis-servicios["'']'
$hasNestedRoute   = $appText -match 'path\s*=\s*["'']mis-servicios["'']'

if (-not $hasAbsoluteRoute -and -not $hasNestedRoute) {
    $routeIndex = -1
    $routeStyle = $null

    # A. Ruta absoluta actual
    for ($i = 0; $i -lt $appLines.Count; $i++) {
        if (
            $appLines[$i] -match '<Route\b' -and
            $appLines[$i] -match '<Servicios\b' -and
            $appLines[$i] -match 'path\s*=\s*["'']\/dashboard\/servicios["'']'
        ) {
            $routeIndex = $i
            $routeStyle = 'absolute'
            break
        }
    }

    # B. Ruta anidada actual: path="servicios"
    if ($routeIndex -lt 0) {
        for ($i = 0; $i -lt $appLines.Count; $i++) {
            if (
                $appLines[$i] -match '<Route\b' -and
                $appLines[$i] -match '<Servicios\b' -and
                $appLines[$i] -match 'path\s*=\s*["'']servicios["'']'
            ) {
                $routeIndex = $i
                $routeStyle = 'nested'
                break
            }
        }
    }

    # C. Fallback: cualquier Route que renderice Servicios.
    if ($routeIndex -lt 0) {
        for ($i = 0; $i -lt $appLines.Count; $i++) {
            if ($appLines[$i] -match '<Route\b' -and $appLines[$i] -match '<Servicios\b') {
                $routeIndex = $i
                if ($appLines[$i] -match 'path\s*=\s*["'']\/dashboard\/') {
                    $routeStyle = 'absolute'
                } else {
                    $routeStyle = 'nested'
                }
                break
            }
        }
    }

    if ($routeIndex -lt 0) {
        throw "No pude localizar ninguna <Route ... element={<Servicios />} /> en App.jsx. Restaura el backup y enviame App.jsx actual."
    }

    $indent = ([regex]::Match($appLines[$routeIndex], '^\s*')).Value

    if ($routeStyle -eq 'absolute') {
        $newRoute = "${indent}<Route path=`"/dashboard/mis-servicios`" element={<MisServicios />} />"
    } else {
        $newRoute = "${indent}<Route path=`"mis-servicios`" element={<MisServicios />} />"
    }

    $appLines.Insert($routeIndex + 1, $newRoute)
}

Set-Content -Path $appPath -Value $appLines -Encoding UTF8

# ============================================================
# DASHBOARDLAYOUT.JSX
# ============================================================
$layoutLines = [System.Collections.Generic.List[string]]::new()
foreach ($line in (Get-Content -Encoding UTF8 $layoutPath)) { $layoutLines.Add($line) }
$layoutText = $layoutLines -join "`n"

if ($layoutText -notmatch '/dashboard/mis-servicios') {
    $insertIndex = -1
    $insertIndent = '      '

    # Preferido: justo despues de const allNav = [
    for ($i = 0; $i -lt $layoutLines.Count; $i++) {
        if ($layoutLines[$i] -match '^\s*const\s+allNav\s*=\s*\[') {
            $insertIndex = $i + 1
            $insertIndent = ([regex]::Match($layoutLines[$i], '^\s*')).Value + '  '
            break
        }
    }

    # Fallback: despues del objeto Servicios en cualquier arreglo de navegacion.
    if ($insertIndex -lt 0) {
        $servicesHrefIndex = -1
        for ($i = 0; $i -lt $layoutLines.Count; $i++) {
            if ($layoutLines[$i] -match 'href\s*:\s*[''"]\/dashboard\/servicios[''"]') {
                $servicesHrefIndex = $i
                break
            }
        }

        if ($servicesHrefIndex -ge 0) {
            for ($j = $servicesHrefIndex; $j -lt [Math]::Min($servicesHrefIndex + 20, $layoutLines.Count); $j++) {
                if ($layoutLines[$j] -match '^\s*\},?\s*$') {
                    $insertIndex = $j + 1
                    $insertIndent = ([regex]::Match($layoutLines[$j], '^\s*')).Value
                    break
                }
            }
        }
    }

    if ($insertIndex -lt 0) {
        throw "No pude localizar el arreglo de navegacion en DashboardLayout.jsx. App.jsx ya fue actualizado; puedes restaurarlo desde $appBackup si deseas."
    }

    $menuBlock = @(
        "${insertIndent}...(",
        "${insertIndent}  (user?.role?.name || user?.rol) === 'tecnico'",
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
}

$layoutText = $layoutLines -join "`n"

# Si navigation usa useMemo y depende solo de canViewModule, agregar user.
$layoutText = [regex]::Replace(
    $layoutText,
    '\},\s*\[\s*canViewModule\s*\]\s*\);',
    '}, [canViewModule, user]);',
    1
)

Set-Content -Path $layoutPath -Value $layoutText -Encoding UTF8

Write-Host ""
Write-Host "OK: MisServicios fue importado en App.jsx."
Write-Host "OK: se agrego la ruta de Mis servicios respetando el estilo actual de rutas."
Write-Host "OK: el menu Mis servicios solo aparece para el rol tecnico."
Write-Host "OK: se crearon backups antes de modificar archivos."
Write-Host ""
Write-Host "Siguiente verificacion:"
Write-Host "  cd .\frontend"
Write-Host "  npm.cmd run build"
