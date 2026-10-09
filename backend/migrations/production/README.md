# Futuras migraciones
La estructura completa ya fue instalada en producción el 9 de octubre de 2026.
No copies aquí el export de localhost ni ACTUALIZAR_TECNICOS_VPS.sql.

Cada futuro cambio de esquema debe incluir un archivo nuevo `AAAAMMDDhhmmss-descripcion.cjs`:

```js
exports.up = async db => {
  await db.query('ALTER TABLE public.nombre_real ADD COLUMN IF NOT EXISTS nueva_columna text');
};
```

El ejemplo es ilustrativo: no crees ese archivo literalmente.
Las migraciones se ejecutan por nombre, con transacción por archivo y registro de checksum.
No edites una migración aplicada: añade otra. No uses BEGIN/COMMIT/ROLLBACK dentro de up,
ni operaciones incompatibles con transacciones, ni cambios destructivos, ni tablas de n8n.
Mantén compatibilidad con la versión anterior para permitir recuperar sus imágenes.
Una migración confirmada no se deshace al recuperar los contenedores anteriores.
