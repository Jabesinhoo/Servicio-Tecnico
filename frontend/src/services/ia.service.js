// frontend/src/services/ia.service.js
import api from './api';

const obtenerMensajeError = (error, mensajePredeterminado) => {
  const estado = error?.response?.status;
  const datos = error?.response?.data;

  const mensaje =
    datos?.message ||
    datos?.error ||
    error?.message ||
    mensajePredeterminado;

  return estado ? `[HTTP ${estado}] ${mensaje}` : mensaje;
};

// Verificar estado de la IA
export const getEstadoIA = async () => {
  try {
    const response = await api.get('/api/ia/estado');
    return response.data;
  } catch (error) {
    console.error('Error al verificar estado de IA:', {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
      url: error?.config?.url,
    });

    return {
      success: false,
      data: {
        disponible: false,
      },
      message: obtenerMensajeError(
        error,
        'No se pudo verificar el estado de la IA'
      ),
    };
  }
};

// Chat principal
export const chatIA = async (
  mensaje,
  modo = 'asistente',
  contexto = ''
) => {
  try {
    const response = await api.post(
      '/api/ia/chat',
      {
        mensaje,
        modo,
        contexto,
      },
      {
        timeout: 180000,
      }
    );

    const resultado = response.data;

    // Acepta ambas estructuras:
    // { success: true, respuesta: "..." }
    // { success: true, data: { respuesta: "..." } }
    const respuesta =
      resultado?.data?.respuesta ??
      resultado?.respuesta ??
      resultado?.data?.response ??
      resultado?.response;

    if (resultado?.success === false) {
      return {
        success: false,
        message:
          resultado?.message ||
          resultado?.error ||
          resultado?.data?.message ||
          resultado?.data?.error ||
          'La IA no pudo procesar la solicitud',
        raw: resultado,
      };
    }

    if (!respuesta) {
      console.error(
        'La respuesta del backend no contiene el texto de la IA:',
        resultado
      );

      return {
        success: false,
        message:
          'El servidor respondió, pero no devolvió una respuesta de la IA',
        raw: resultado,
      };
    }

    return {
      success: true,
      data: {
        respuesta,
      },
      raw: resultado,
    };
  } catch (error) {
    console.error('Error completo en chat IA:', {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
      code: error?.code,
      method: error?.config?.method,
      url: error?.config?.url,
      baseURL: error?.config?.baseURL,
    });

    return {
      success: false,
      message: obtenerMensajeError(
        error,
        'Error al procesar la solicitud'
      ),
    };
  }
};

// Analizar equipo
export const analizarEquipoIA = async (descripcion) => {
  try {
    const response = await api.post(
      '/api/ia/analizar-equipo',
      { descripcion },
      { timeout: 180000 }
    );

    return response.data;
  } catch (error) {
    console.error('Error al analizar equipo:', error);

    return {
      success: false,
      message: obtenerMensajeError(
        error,
        'Error al analizar el equipo'
      ),
    };
  }
};

// Resumir servicio
export const resumirServicioIA = async (data) => {
  try {
    const response = await api.post(
      '/api/ia/resumir-servicio',
      data,
      { timeout: 180000 }
    );

    return response.data;
  } catch (error) {
    console.error('Error al resumir servicio:', error);

    return {
      success: false,
      message: obtenerMensajeError(
        error,
        'Error al generar el resumen'
      ),
    };
  }
};

// Sugerir repuestos
export const sugerirRepuestosIA = async (diagnostico) => {
  try {
    const response = await api.post(
      '/api/ia/sugerir-repuestos',
      { diagnostico },
      { timeout: 180000 }
    );

    return response.data;
  } catch (error) {
    console.error('Error al sugerir repuestos:', error);

    return {
      success: false,
      message: obtenerMensajeError(
        error,
        'Error al sugerir repuestos'
      ),
    };
  }
};

// Asistencia técnica rápida
export const asistenciaTecnicaIA = async (pregunta) => {
  try {
    const response = await api.post(
      '/api/ia/asistencia',
      { pregunta },
      { timeout: 180000 }
    );

    return response.data;
  } catch (error) {
    console.error('Error en asistencia técnica:', error);

    return {
      success: false,
      message: obtenerMensajeError(
        error,
        'Error al procesar la asistencia'
      ),
    };
  }
};