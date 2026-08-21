# Ejecutar desde la raíz de Servicio-Tecnico.
# Este script modifica únicamente DashboardLayout.jsx para montar LocationTracker.
# Antes de cambiarlo crea una copia .bak-location.

$ErrorActionPreference = 'Stop'

$dashboardPath = Join-Path $PWD 'frontend\src\components\DashboardLayout.jsx'

if (-not (Test-Path $dashboardPath)) {
    throw "No se encontró: $dashboardPath. Ejecuta este script desde la raíz de Servicio-Tecnico."
}

$content = Get-Content -Raw -Encoding UTF8 $dashboardPath
$backupPath = "$dashboardPath.bak-location"

if (-not (Test-Path $backupPath)) {
    Copy-Item $dashboardPath $backupPath
    Write-Host "Backup creado: $backupPath" -ForegroundColor Yellow
}

$importLine = "import LocationTracker from './LocationTracker';"

if ($content -notmatch [regex]::Escape($importLine)) {
    $iaImport = "import IAChat from './ui/IAChat';"

    if ($content.Contains($iaImport)) {
        $content = $content.Replace(
            $iaImport,
            "$iaImport`r`n$importLine"
        )
    }
    else {
        # Fallback: insertar antes del primer bloque de imports de lucide-react.
        $lucideMarker = "import {"
        $index = $content.IndexOf($lucideMarker)

        if ($index -lt 0) {
            throw 'No se encontró un punto seguro para agregar el import de LocationTracker.'
        }

        $content = $content.Insert($index, "$importLine`r`n`r`n")
    }
}

if ($content -notmatch '<LocationTracker\s*/>') {
    $notificationMarker = '              <NotificacionesCampana />'

    if ($content.Contains($notificationMarker)) {
        $content = $content.Replace(
            $notificationMarker,
            "              <LocationTracker />`r`n$notificationMarker"
        )
    }
    else {
        throw 'No se encontró <NotificacionesCampana />. No se modificó el JSX automáticamente.'
    }
}

Set-Content -Path $dashboardPath -Value $content -Encoding UTF8

$verify = Get-Content -Raw -Encoding UTF8 $dashboardPath

if (
    $verify -notmatch [regex]::Escape($importLine) -or
    $verify -notmatch '<LocationTracker\s*/>'
) {
    throw 'El parche no pudo verificarse correctamente.'
}

Write-Host 'OK: LocationTracker quedó montado en DashboardLayout.jsx' -ForegroundColor Green
Write-Host 'Backup disponible en DashboardLayout.jsx.bak-location' -ForegroundColor DarkGray
