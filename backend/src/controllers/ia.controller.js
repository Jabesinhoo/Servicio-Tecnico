// backend/src/controllers/ia.controller.js
const iaService = require('../services/ia.service');

// Chat con modo (asistente o consulta)
exports.chat = async (req, res) => {
  try {
    const { mensaje, modo = 'asistente' } = req.body;
    const userId = req.user.id;
    const rol = req.user.rol || 'usuario';
    const tecnico_id = rol === 'tecnico' ? req.user.id : null;

    if (!mensaje) {
      return res.status(400).json({
        success: false,
        message: 'El mensaje es requerido'
      });
    }

    const result = await iaService.chatConModo(userId, mensaje, modo, rol, tecnico_id);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al procesar la solicitud',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        respuesta: result.respuesta,
        tool: result.tool || null,
        datos: result.datos || null,
        rol: rol
      }
    });
  } catch (error) {
    console.error('Error en chat:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la solicitud',
      error: error.message
    });
  }
};

exports.getAlertas = async (req, res) => {
  try {
    const rol = req.user.rol || 'usuario';
    const tecnico_id = rol === 'tecnico' ? req.user.id : null;
    const alertas = await iaService.generarAlertas(rol, tecnico_id);

    res.json({
      success: true,
      data: alertas
    });
  } catch (error) {
    console.error('Error al obtener alertas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener alertas',
      error: error.message
    });
  }
};

exports.estado = async (req, res) => {
  try {
    const result = await iaService.verificarConexion();
    res.json({
      success: true,
      data: {
        disponible: result.success,
        modelo: process.env.OLLAMA_MODEL || 'llama3.2:3b',
        mensaje: result.message || result.error
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Actualizar contexto del usuario
exports.actualizarContexto = async (req, res) => {
  try {
    const userId = req.user.id;
    const { servicioActual, clienteActual, ultimaAccion, tareaPendiente } = req.body;

    iaService.actualizarContexto(userId, {
      nombre: req.user.nombre1 || req.user.usuario,
      rol: req.user.rol,
      servicioActual,
      clienteActual,
      ultimaAccion,
      tareaPendiente
    });

    res.json({
      success: true,
      message: 'Contexto actualizado correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar contexto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar contexto',
      error: error.message
    });
  }
};

// Obtener contexto actual del usuario
exports.obtenerContexto = async (req, res) => {
  try {
    const userId = req.user.id;
    const sesion = iaService.getSesion(userId);

    res.json({
      success: true,
      data: sesion.contexto
    });
  } catch (error) {
    console.error('Error al obtener contexto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener contexto',
      error: error.message
    });
  }
};

// Limpiar historial de la sesión
exports.limpiarHistorial = async (req, res) => {
  try {
    const userId = req.user.id;
    const sesion = iaService.getSesion(userId);
    sesion.historial = [];
    sesion.ultimaActividad = Date.now();

    res.json({
      success: true,
      message: 'Historial limpiado correctamente'
    });
  } catch (error) {
    console.error('Error al limpiar historial:', error);
    res.status(500).json({
      success: false,
      message: 'Error al limpiar historial',
      error: error.message
    });
  }
};



// Analizar equipo
exports.analizarEquipo = async (req, res) => {
  try {
    const { descripcion } = req.body;

    if (!descripcion) {
      return res.status(400).json({
        success: false,
        message: 'La descripción del problema es requerida'
      });
    }

    const result = await iaService.analizarEquipo(descripcion);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al analizar el equipo',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Error en analizar equipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al analizar el equipo',
      error: error.message
    });
  }
};

// Resumir servicio
exports.resumirServicio = async (req, res) => {
  try {
    const { descripcion_inicial, acciones, resultado, tecnico, cliente } = req.body;

    if (!descripcion_inicial && !acciones && !resultado) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere al menos descripción, acciones o resultado'
      });
    }

    const result = await iaService.resumirServicio({
      descripcionInicial: descripcion_inicial,
      acciones,
      resultado,
      tecnico,
      cliente
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al generar el resumen',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        resumen: result.respuesta
      }
    });
  } catch (error) {
    console.error('Error en resumir servicio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar el resumen',
      error: error.message
    });
  }
};

// Sugerir repuestos
exports.sugerirRepuestos = async (req, res) => {
  try {
    const { diagnostico } = req.body;

    if (!diagnostico) {
      return res.status(400).json({
        success: false,
        message: 'El diagnóstico es requerido'
      });
    }

    const result = await iaService.sugerirRepuestos(diagnostico);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al sugerir repuestos',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Error en sugerir repuestos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al sugerir repuestos',
      error: error.message
    });
  }
};

// Asistencia técnica rápida
exports.asistenciaTecnica = async (req, res) => {
  try {
    const { pregunta } = req.body;

    if (!pregunta) {
      return res.status(400).json({
        success: false,
        message: 'La pregunta es requerida'
      });
    }

    const result = await iaService.asistenciaTecnica(pregunta);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al procesar la asistencia',
        error: result.error
      });
    }

    res.json({
      success: true,
      data: {
        respuesta: result.respuesta
      }
    });
  } catch (error) {
    console.error('Error en asistencia técnica:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la asistencia',
      error: error.message
    });
  }
};