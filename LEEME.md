# Corregir sincronización de clientes en producción

El error ocurre porque la sincronización borraba sync_clientes antes de insertarlos
de nuevo. solicitudes_alquiler tiene una FK que impide ese borrado.

Copia backend/src/services/worldoffice-client-mirror.service.js del ZIP sobre el archivo
con el mismo nombre en tu proyecto de Windows. Haz commit y push a main y espera que
Actions termine correctamente. Luego ejecuta en el VPS:

```bash
docker exec tecnicos_backend node scripts/sync-client-profiles.js
```

La nueva implementación actualiza por id_externo y agrega los nuevos, conservando los
IDs internos y las relaciones de alquiler. Refresca los campos completos y la fecha de
sincronización. Conserva clientes históricos que ya no llegan de World Office y respeta
los contactos completados manualmente en clients. Se usa también por el scheduler.
No requiere migración SQL, borrar registros, cambiar constraints ni recrear contenedores
a mano. Si una fila falla, revierte la transacción completa.

Validación local con PostgreSQL embebido (PGlite): referencias a id e id_externo,
IDs estables, nuevos clientes sin duplicados, históricos conservados, preservación del
contacto manual y rollback completo ante un error a mitad de sincronización.

Tras la sincronización, vuelve a abrir el formulario y selecciona el cliente. Si todavía
faltan datos, revisa el perfil y los campos originales: la sincronización no inventa
información ausente en World Office.

Una limpieza independiente de los datos de prueba debe conservar usuarios, roles,
permissions y las relaciones de permisos, además de las tablas de n8n presentes en la
misma base. Este paquete no realiza esa limpieza.
