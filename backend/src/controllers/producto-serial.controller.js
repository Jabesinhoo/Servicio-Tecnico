// backend/src/controllers/producto-serial.controller.js
const productoSerialService = require('../services/producto-serial.service');

// Obtener todos los productos sincronizados
exports.getProductos = async (req, res) => {
    try {
        const productos = await productoSerialService.getProductosSync();
        res.json({
            success: true,
            data: productos,
            total: productos.length
        });
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener productos',
            error: error.message
        });
    }
};

// Buscar productos
exports.searchProductos = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json({
                success: true,
                data: [],
                message: 'Ingrese al menos 2 caracteres para buscar'
            });
        }
        const productos = await productoSerialService.buscarProductos(q);
        res.json({
            success: true,
            data: productos
        });
    } catch (error) {
        console.error('Error al buscar productos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al buscar productos',
            error: error.message
        });
    }
};

// Obtener producto por codigo
exports.getProductoByCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;
        const producto = await productoSerialService.getProductoByCodigo(codigo);
        if (!producto) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }
        res.json({
            success: true,
            data: producto
        });
    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener producto',
            error: error.message
        });
    }
};

// Obtener seriales de un producto
exports.getSeriales = async (req, res) => {
    try {
        const { productoId } = req.params;
        const seriales = await productoSerialService.getSerialesByProducto(productoId);
        res.json({
            success: true,
            data: seriales
        });
    } catch (error) {
        console.error('Error al obtener seriales:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener seriales',
            error: error.message
        });
    }
};

// Crear serial
exports.crearSerial = async (req, res) => {
    try {
        const { producto_id, serial, observaciones } = req.body;
        
        if (!producto_id || !serial) {
            return res.status(400).json({
                success: false,
                message: 'Producto ID y serial son requeridos'
            });
        }
        
        // Verificar si el serial ya existe
        const existente = await productoSerialService.buscarSerial(serial);
        if (existente) {
            return res.status(409).json({
                success: false,
                message: 'Este serial ya esta registrado'
            });
        }
        
        const nuevoSerial = await productoSerialService.crearSerial(producto_id, serial, observaciones);
        
        res.status(201).json({
            success: true,
            data: nuevoSerial
        });
    } catch (error) {
        console.error('Error al crear serial:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear serial',
            error: error.message
        });
    }
};

// Buscar serial
exports.buscarSerial = async (req, res) => {
    try {
        const { serial } = req.params;
        const resultado = await productoSerialService.buscarSerial(serial);
        if (!resultado) {
            return res.status(404).json({
                success: false,
                message: 'Serial no encontrado'
            });
        }
        res.json({
            success: true,
            data: resultado
        });
    } catch (error) {
        console.error('Error al buscar serial:', error);
        res.status(500).json({
            success: false,
            message: 'Error al buscar serial',
            error: error.message
        });
    }
};

// Cambiar estado de serial
exports.cambiarEstado = async (req, res) => {
    try {
        const { serialId } = req.params;
        const { estado, ubicacion, observaciones } = req.body;
        
        const estadosValidos = ['disponible', 'alquilado', 'en_revision', 'vendido', 'en_bodega', 'mantenimiento'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({
                success: false,
                message: `Estado no valido. Estados permitidos: ${estadosValidos.join(', ')}`
            });
        }
        
        const serial = await productoSerialService.cambiarEstadoSerial(serialId, estado, ubicacion);
        
        // Registrar en historial
        await productoSerialService.registrarMovimientoSerial(
            serialId,
            estado,
            'sistema',
            ubicacion || 'bodega',
            req.user?.id || null,
            observaciones || `Cambio de estado a ${estado}`
        );
        
        res.json({
            success: true,
            data: serial
        });
    } catch (error) {
        console.error('Error al cambiar estado:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar estado',
            error: error.message
        });
    }
};

// Obtener historial de serial
exports.getHistorial = async (req, res) => {
    try {
        const { serialId } = req.params;
        const historial = await productoSerialService.getHistorialSerial(serialId);
        res.json({
            success: true,
            data: historial
        });
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener historial',
            error: error.message
        });
    }
};