Preparación de producción — Servicio Técnico TecnoNacho

Estos archivos preparan la migración; no instalan ni modifican el VPS.

1. En Windows, copia exportar-estructura.js a backend/scripts del proyecto que ya funciona. Desde backend ejecuta:

   node .\scripts\exportar-estructura.js

Genera estructura-produccion-*.sql usando las credenciales del .env sin imprimirlas. Solo exporta estructura de PostgreSQL: tablas, relaciones, índices, vistas, funciones, disparadores y demás objetos de la base. No copia los registros ni los valores actuales de las secuencias. El archivo conserva las definiciones de funciones: revísalo antes de compartirlo si tienes lógica personalizada con valores privados incrustados. Requiere pg_dump compatible con la versión local. El esquema no contiene registros de roles, permisos ni administrador: esos datos iniciales se crean después en producción.

2. En el VPS, ejecuta el diagnóstico desde tu usuario habitual:

   bash diagnostico-vps.sh

Muestra versiones, nombres y rutas de procesos, puertos, contenedores y navegador de PDF. No lee .env ni modifica servicios. Compartir su salida y el SQL permite preparar comandos exactos para la instalación existente. No envíes contraseñas, claves SSH ni el contenido completo de .env.

3. Antes de importar se revisa si el PostgreSQL del VPS ya tiene estructura o datos; la importación completa se realiza en una base nueva y vacía. Debe verificarse compatibilidad de versiones PostgreSQL. Se crea su usuario con permisos adecuados y se usa --single-transaction y ON_ERROR_STOP al restaurar. No se ejecutan todos los SQL históricos indiscriminadamente: algunos incluyen reparaciones de datos locales o dependen de objetos previos. El esquema exportado incluye las migraciones ya aplicadas en localhost.

4. Con la estructura verificada se crean los roles/permisos iniciales y un administrador nuevo. Luego se revisan DB_*, JWT, CORS, VITE_API_URL y reconstrucción del frontend, proceso PM2/Docker, Nginx/HTTPS, almacenamiento persistente de adjuntos y firmas, Chromium para PDF y copias de seguridad. Se valida login, creación/agenda, asignación/notificaciones, materiales y actas.

5. World Office necesita una ruta de red desde el VPS al SQL Server de la oficina. Cambiar TECNOSERVER por un texto o IP inaccesible no crea esa conexión. Se comprueba si existe VPN o túnel; si falta, se prepara uno y se usa su dirección y puerto reales. La función de resolución mediante Windows no existe en Linux. Mientras no esté conectado, la factura debe seguir siendo opcional. La estructura se importa sin los registros locales; cualquier futura sincronización de clientes/facturas se define y habilita de forma separada.
