SERVICIO TECNICO V11
AGENDA AUTOMATICA MULTITECNICO + FIX CLIENTE WORLDOFFICE + ESTADISTICAS + RESPONSIVE

QUE CORRIGE
===========
1. ERROR "Cliente invalido"
   El buscador actual mezcla:
   - clientes locales: id UUID
   - clientes WorldOffice/Melissa: id_externo numerico

   V9/V10 exigian UUID antes de saber el origen.
   V11 detecta el origen:
   - local UUID -> usa el cliente local
   - Melissa/WorldOffice -> busca id_externo, reutiliza cliente local por
     codigo_worldoffice/documento o crea un vinculo local UUID sin modificar
     la tabla sync_clientes.

2. FECHA/HORA DE CREACION
   Ya no se pide al usuario "Fecha tentativa" ni "Hora tentativa".
   created_at / createdAt siguen siendo automaticos en base de datos.

3. AGENDA AUTOMATICA
   Cuando el admin crea/aprueba la OS:
   - toma principal + apoyos
   - revisa horarios laborales
   - busca primer bloque comun libre
   - redondea a intervalos de 15 min
   - bloquea a TODOS los tecnicos seleccionados
   - guarda mismo inicio/fin para todo el equipo
   - actualiza fecha_agendada / hora_inicio_agendada de la OS

4. TECNICOS CHECK / UNCHECK
   En el wizard:
   - checkbox para seleccionar/desseleccionar
   - radio para indicar cual de los marcados es responsable principal
   - Marcar visibles
   - Desmarcar todos

5. ESTADISTICAS TECNICAS
   Reportes ahora incluye un panel responsive con:
   - ingreso confirmado del area
   - total servicios
   - completados
   - activos
   - grafica mensual
   - ranking visual por tecnico
   - tabla de tecnicos
   - ingreso gestionado por principal
   - servicios como apoyo
   - horas registradas

6. RESPONSIVE
   V11 revisa de forma explicita:
   - Nueva OS
   - Agenda
   - Reportes/estadisticas

   Celular:
   - 100dvh en wizard
   - agenda abre por defecto en Dia
   - calendario con scroll horizontal controlado
   - tabla de estadisticas cambia a tarjetas

   Tablet:
   - layouts 1/2 columnas
   - tablas con overflow seguro

   PC/TV:
   - agenda amplia
   - dashboard estadistico 4 KPIs
   - graficas lado a lado en pantallas grandes

COMO FUNCIONA EL BLOQUEO DE AGENDA
==================================
Ejemplo:
Principal: Carlos
Apoyo: Andrea
Duracion estimada: 90 min

Si ambos tienen libre:
28/08/2026 10:15 - 11:45

V11 crea:
Carlos  -> ocupado 10:15 - 11:45
Andrea  -> ocupado 10:15 - 11:45

Otra OS no podra agendar automaticamente a ninguno dentro de ese intervalo.

Si cualquiera ya tiene una OS:
10:30 - 12:00

V11 busca el siguiente espacio comun.

Si un tecnico figura EN_EJECUCION en otro servicio, V11 evita asignarle otro
servicio para el resto del dia durante la busqueda automatica de ese momento.

IMPORTANTE:
El bloqueo horario usa la DURACION ESTIMADA.
Cuando construyamos el cierre V12, el sistema liberara/cerrara formalmente el
bloque cuando termine la ejecucion real y podremos medir desviacion
estimado-vs-real.

ESTADISTICAS / INGRESOS
=======================
V11 NO inventa contabilidad.

Ingreso confirmado:
- servicios V9/V11 prepago: base_value con payment_status = verified
- ordenes legacy sin intake: total_general solo si estado = cerrada

No se cuentan como ingreso confirmado:
- presupuestos
- autorizaciones adicionales solo aprobadas pero no pagadas
- pospago aun sin registro real de pago

Por eso el panel se llama "Ingreso confirmado" y no reemplaza WorldOffice.
Cuando integremos cierre/facturacion final, este origen se puede cambiar sin
romper el dashboard.

INSTALACION
===========
REQUISITO: V10 instalado.

1. Extraer ZIP en:
C:\Users\USUARIO\Desktop\inventario-app\Servicio-Tecnico

2. Ejecutar:
powershell -ExecutionPolicy Bypass -File .\APLICAR-ACTUALIZACION-V11.ps1

3. Ejecutar SOLO SQL V11:
Get-Content -Raw .\backend\sql\20260828-auto-schedule-stats-v11.sql | docker exec -i tecnicos_db psql -U postgres -d tecnicos

4. Verificar:
powershell -ExecutionPolicy Bypass -File .\VERIFICAR-V11.ps1

5. Frontend:
cd .\frontend
npm.cmd run build
npm.cmd run dev

6. Backend:
cd ..\backend
npm.cmd run dev

PRUEBA 1 - CLIENTE WORLDOFFICE
==============================
Servicios -> Nueva OS
Buscar un cliente que muestre origen Melissa/WorldOffice.
Seleccionarlo y completar.
Ya no debe responder "Cliente invalido".

PRUEBA 2 - EQUIPO
=================
Seleccionar:
[x] Carlos -> Responsable principal
[x] Andrea -> apoyo
[ ] Pedro

La interfaz debe permitir check/uncheck.

PRUEBA 3 - AGENDA
=================
Completar pago y crear la OS.
La OS debe terminar asignada y aparecer en Agenda para Carlos y Andrea con
el mismo inicio y fin.

PRUEBA 4 - CONFLICTO
====================
Crear otra OS con Carlos en el equipo.
No debe superponer el bloque anterior; debe buscar el siguiente espacio comun.

PRUEBA 5 - ESTADISTICAS
=======================
Reportes -> parte superior:
Estadisticas del Area Tecnica.

Debe adaptarse en telefono, tablet, PC y TV.

NO HACER
========
- No ejecutar migraciones historicas.
- No ejecutar sync({force:true}).
- No ejecutar sync({alter:true}).
- No repetir SQL anteriores.
