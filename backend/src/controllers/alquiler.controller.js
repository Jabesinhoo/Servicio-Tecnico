// backend/src/controllers/alquiler.controller.js
const alquilerService = require('../services/alquiler.service');

// ============================================================
// 1. SOLICITUDES DE ALQUILER
// ============================================================

// Crear solicitud de alquiler
exports.crearSolicitud = async (req, res) => {
    try {
        const { cliente_id, fecha_inicio, fecha_fin, observaciones } = req.body;
        const vendedor_id = req.user.id;

        if (!cliente_id || !fecha_inicio || !fecha_fin) {
            return res.status(400).json({
                success: false,
                message: 'Cliente, fecha de inicio y fecha de fin son requeridos'
            });
        }

        const solicitud = await alquilerService.crearSolicitud({
            cliente_id,
            vendedor_id,
            fecha_inicio,
            fecha_fin,
            observaciones
        });

        // Crear notificacion para contabilidad
        await alquilerService.crearNotificacion({
            usuario_id: null, // Se enviara a todos los usuarios con rol contabilidad
            tipo: 'solicitud',
            titulo: 'Nueva solicitud de alquiler',
            mensaje: `La solicitud ${solicitud.numero_solicitud} requiere autorizacion de documentacion`,
            link: `/alquileres/solicitudes/${solicitud.id}`,
            solicitud_id: solicitud.id
        });

        res.status(201).json({
            success: true,
            data: solicitud
        });
    } catch (error) {
        console.error('Error al crear solicitud:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear solicitud',
            error: error.message
        });
    }
};

// Obtener solicitudes
exports.getSolicitudes = async (req, res) => {
    try {
        const { estado, cliente_id } = req.query;
        const filtros = {};
        if (estado) filtros.estado = estado;
        if (cliente_id) filtros.cliente_id = cliente_id;
        
        // Si es tecnico, solo ve sus solicitudes asignadas
        if (req.user.rol === 'tecnico') {
            // Obtener solicitudes donde el tecnico tiene items asignados
            filtros.tecnico_id = req.user.id;
        }

        const solicitudes = await alquilerService.getSolicitudes(filtros);
        res.json({
            success: true,
            data: solicitudes,
            total: solicitudes.length
        });
    } catch (error) {
        console.error('Error al obtener solicitudes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener solicitudes',
            error: error.message
        });
    }
};

// Obtener solicitud por ID
exports.getSolicitudById = async (req, res) => {
    try {
        const { id } = req.params;
        const solicitud = await alquilerService.getSolicitudById(id);
        
        if (!solicitud) {
            return res.status(404).json({
                success: false,
                message: 'Solicitud no encontrada'
            });
        }

        // Obtener items de la solicitud
        const items = await alquilerService.getItemsBySolicitud(id);

        res.json({
            success: true,
            data: {
                ...solicitud,
                items
            }
        });
    } catch (error) {
        console.error('Error al obtener solicitud:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener solicitud',
            error: error.message
        });
    }
};

// Actualizar estado de solicitud
exports.actualizarEstado = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, observaciones } = req.body;

        const estadosValidos = ['pendiente', 'aprobado', 'rechazado', 'en_proceso', 'completado'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({
                success: false,
                message: `Estado no valido. Estados permitidos: ${estadosValidos.join(', ')}`
            });
        }

        const solicitud = await alquilerService.actualizarEstadoSolicitud(id, estado, observaciones);

        // Crear notificacion para el vendedor
        await alquilerService.crearNotificacion({
            usuario_id: solicitud.vendedor_id,
            tipo: 'estado',
            titulo: `Solicitud ${solicitud.numero_solicitud} actualizada`,
            mensaje: `La solicitud cambio a estado: ${estado}`,
            link: `/alquileres/solicitudes/${solicitud.id}`,
            solicitud_id: solicitud.id
        });

        res.json({
            success: true,
            data: solicitud
        });
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar estado',
            error: error.message
        });
    }
};

// Aprobar documentacion
exports.aprobarDocumentacion = async (req, res) => {
    try {
        const { id } = req.params;
        const { aprobado, observaciones } = req.body;

        if (aprobado === undefined) {
            return res.status(400).json({
                success: false,
                message: 'El campo "aprobado" es requerido (true/false)'
            });
        }

        const solicitud = await alquilerService.aprobarDocumentacion(id, aprobado, observaciones);

        if (aprobado) {
            // Crear notificacion para bodega
            await alquilerService.crearNotificacion({
                usuario_id: null, // Se enviara a todos los usuarios con rol bodega
                tipo: 'aprobacion',
                titulo: `Solicitud ${solicitud.numero_solicitud} aprobada`,
                mensaje: 'La documentacion fue aprobada. Proceder con el despacho.',
                link: `/alquileres/solicitudes/${solicitud.id}`,
                solicitud_id: solicitud.id
            });
        }

        res.json({
            success: true,
            data: solicitud
        });
    } catch (error) {
        console.error('Error al aprobar documentacion:', error);
        res.status(500).json({
            success: false,
            message: 'Error al aprobar documentacion',
            error: error.message
        });
    }
};

// ============================================================
// 2. ITEMS DE ALQUILER
// ============================================================

// Agregar item a solicitud
exports.agregarItem = async (req, res) => {
    try {
        const { solicitud_id } = req.params;
        const { producto_id, serial_id, cantidad } = req.body;

        if (!producto_id) {
            return res.status(400).json({
                success: false,
                message: 'Producto es requerido'
            });
        }

        const item = await alquilerService.agregarItemAlquiler({
            solicitud_id,
            producto_id,
            serial_id,
            cantidad
        });

        res.status(201).json({
            success: true,
            data: item
        });
    } catch (error) {
        console.error('Error al agregar item:', error);
        res.status(500).json({
            success: false,
            message: 'Error al agregar item',
            error: error.message
        });
    }
};

// Asignar tecnico a item
exports.asignarTecnico = async (req, res) => {
    try {
        const { item_id } = req.params;
        const { tecnico_id } = req.body;

        if (!tecnico_id) {
            return res.status(400).json({
                success: false,
                message: 'Tecnico es requerido'
            });
        }

        const item = await alquilerService.asignarTecnicoItem(item_id, tecnico_id);

        // Crear notificacion para el tecnico
        await alquilerService.crearNotificacion({
            usuario_id: tecnico_id,
            tipo: 'asignacion',
            titulo: 'Nuevo item asignado',
            mensaje: 'Se te ha asignado un item para revision',
            link: `/alquileres/revision/${item_id}`,
            solicitud_id: item.solicitud_id
        });

        res.json({
            success: true,
            data: item
        });
    } catch (error) {
        console.error('Error al asignar tecnico:', error);
        res.status(500).json({
            success: false,
            message: 'Error al asignar tecnico',
            error: error.message
        });
    }
};

// ============================================================
// 3. NOTIFICACIONES
// ============================================================

// Obtener notificaciones del usuario
exports.getNotificaciones = async (req, res) => {
    try {
        const usuario_id = req.user.id;
        const { solo_no_leidas } = req.query;
        
        const notificaciones = await alquilerService.getNotificaciones(
            usuario_id,
            solo_no_leidas === 'true'
        );
        
        const noLeidas = await alquilerService.contarNotificacionesNoLeidas(usuario_id);

        res.json({
            success: true,
            data: notificaciones,
            no_leidas: noLeidas
        });
    } catch (error) {
        console.error('Error al obtener notificaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener notificaciones',
            error: error.message
        });
    }
};

// Marcar notificacion como leida
exports.marcarNotificacionLeida = async (req, res) => {
    try {
        const { id } = req.params;
        const notificacion = await alquilerService.marcarNotificacionLeida(id);
        res.json({
            success: true,
            data: notificacion
        });
    } catch (error) {
        console.error('Error al marcar notificacion:', error);
        res.status(500).json({
            success: false,
            message: 'Error al marcar notificacion',
            error: error.message
        });
    }
};

// Marcar todas las notificaciones como leidas
exports.marcarTodasLeidas = async (req, res) => {
    try {
        await alquilerService.marcarTodasLeidas(req.user.id);
        res.json({
            success: true,
            message: 'Todas las notificaciones marcadas como leidas'
        });
    } catch (error) {
        console.error('Error al marcar todas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al marcar todas',
            error: error.message
        });
    }
};

// ============================================================
// 4. REVISIONES TECNICAS
// ============================================================

// Crear revision tecnica
exports.crearRevision = async (req, res) => {
    try {
        const { item_id } = req.params;
        const { estado_producto, observaciones, imagenes, firma_tecnico } = req.body;
        const tecnico_id = req.user.id;

        if (!estado_producto) {
            return res.status(400).json({
                success: false,
                message: 'Estado del producto es requerido'
            });
        }

        const revision = await alquilerService.crearRevisionTecnica({
            alquiler_item_id: item_id,
            tecnico_id,
            estado_producto,
            observaciones,
            imagenes: imagenes || [],
            firma_tecnico
        });

        // Notificar que el item fue revisado
        const item = await alquilerService.getItemsBySolicitud(item_id);
        // Obtener la solicitud para notificar al vendedor
        const solicitud = await alquilerService.getSolicitudById(item[0]?.solicitud_id);

        if (solicitud) {
            await alquilerService.crearNotificacion({
                usuario_id: solicitud.vendedor_id,
                tipo: 'revision',
                titulo: `Item revisado`,
                mensaje: `El item ha sido revisado por el tecnico`,
                link: `/alquileres/solicitudes/${solicitud.id}`,
                solicitud_id: solicitud.id
            });
        }

        res.status(201).json({
            success: true,
            data: revision
        });
    } catch (error) {
        console.error('Error al crear revision:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear revision',
            error: error.message
        });
    }
};

// Obtener revisiones de un item
exports.getRevisiones = async (req, res) => {
    try {
        const { item_id } = req.params;
        const revisiones = await alquilerService.getRevisionesByItem(item_id);
        res.json({
            success: true,
            data: revisiones
        });
    } catch (error) {
        console.error('Error al obtener revisiones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener revisiones',
            error: error.message
        });
    }
};

// ============================================================
// 5. DESPACHOS DE BODEGA
// ============================================================

// Crear despacho
exports.crearDespacho = async (req, res) => {
    try {
        const { solicitud_id } = req.params;
        const { observaciones } = req.body;
        const responsable_id = req.user.id;

        const despacho = await alquilerService.crearDespacho({
            solicitud_id,
            responsable_id,
            observaciones
        });

        // Notificar a servicio tecnico
        await alquilerService.crearNotificacion({
            usuario_id: null, // Se enviara a todos los tecnicos
            tipo: 'despacho',
            titulo: `Despacho pendiente de revision`,
            mensaje: `Los productos de la solicitud estan listos para revision tecnica`,
            link: `/alquileres/despachos/${despacho.id}`,
            solicitud_id: solicitud_id
        });

        res.status(201).json({
            success: true,
            data: despacho
        });
    } catch (error) {
        console.error('Error al crear despacho:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear despacho',
            error: error.message
        });
    }
};

// Completar despacho
exports.completarDespacho = async (req, res) => {
    try {
        const { id } = req.params;
        const { observaciones } = req.body;

        const despacho = await alquilerService.completarDespacho(id, observaciones);

        res.json({
            success: true,
            data: despacho
        });
    } catch (error) {
        console.error('Error al completar despacho:', error);
        res.status(500).json({
            success: false,
            message: 'Error al completar despacho',
            error: error.message
        });
    }
};

// ============================================================
// 6. DEVOLUCIONES
// ============================================================

// Crear devolucion
exports.crearDevolucion = async (req, res) => {
    try {
        const { solicitud_id } = req.params;
        const { tipo, tecnico_id, observaciones } = req.body;
        const vendedor_id = req.user.id;

        if (!tipo) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de devolucion es requerido (local, nacional, alto_volumen)'
            });
        }

        const devolucion = await alquilerService.crearDevolucion({
            solicitud_id,
            tipo,
            vendedor_id,
            tecnico_id,
            observaciones
        });

        // Notificar a servicio tecnico
        if (tecnico_id) {
            await alquilerService.crearNotificacion({
                usuario_id: tecnico_id,
                tipo: 'devolucion',
                titulo: `Devolucion pendiente`,
                mensaje: `Se requiere revision de devolucion para la solicitud`,
                link: `/alquileres/devoluciones/${devolucion.id}`,
                solicitud_id: solicitud_id
            });
        }

        res.status(201).json({
            success: true,
            data: devolucion
        });
    } catch (error) {
        console.error('Error al crear devolucion:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear devolucion',
            error: error.message
        });
    }
};

// Completar devolucion
exports.completarDevolucion = async (req, res) => {
    try {
        const { id } = req.params;
        const { observaciones } = req.body;

        const devolucion = await alquilerService.completarDevolucion(id, observaciones);

        // Notificar a contabilidad e inventario
        await alquilerService.crearNotificacion({
            usuario_id: null, // Se enviara a contabilidad e inventario
            tipo: 'devolucion_completada',
            titulo: `Devolucion completada`,
            mensaje: `La devolucion de la solicitud ha sido completada`,
            link: `/alquileres/devoluciones/${devolucion.id}`,
            solicitud_id: devolucion.solicitud_id
        });

        res.json({
            success: true,
            data: devolucion
        });
    } catch (error) {
        console.error('Error al completar devolucion:', error);
        res.status(500).json({
            success: false,
            message: 'Error al completar devolucion',
            error: error.message
        });
    }
};

// ============================================================
// 7. EXPORTAR PARA INVENTARIO
// ============================================================

exports.exportarInventario = async (req, res) => {
    try {
        const { solicitud_id } = req.params;
        const data = await alquilerService.exportarParaInventario(solicitud_id);

        // Generar CSV
        const headers = ['NUMERO_SOLICITUD', 'CLIENTE', 'DOCUMENTO', 'FECHA_INICIO', 'FECHA_FIN', 'SKU', 'PRODUCTO', 'SN', 'CANTIDAD', 'ESTADO'];
        let csv = headers.join(',') + '\n';
        
        data.forEach(row => {
            const values = [
                row.numero_solicitud,
                `"${row.cliente_nombre || ''}"`,
                row.cliente_documento || '',
                row.fecha_inicio || '',
                row.fecha_fin || '',
                row.sku || '',
                `"${row.producto_nombre || ''}"`,
                row.sn || '',
                row.cantidad || 1,
                row.estado_revision || ''
            ];
            csv += values.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=inventario_solicitud_${solicitud_id}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Error al exportar:', error);
        res.status(500).json({
            success: false,
            message: 'Error al exportar',
            error: error.message
        });
    }
};