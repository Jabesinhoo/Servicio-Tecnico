// frontend/src/services/ia.service.js
import api from './api';

// Verificar estado de la IA
export const getEstadoIA = async () => {
  try {
    const response = await api.get('/api/ia/estado');
    return response.data;
  } catch (error) {
    console.error('Error al verificar estado de IA:', error);
    return { success: false, data: { disponible: false } };
  }
};



export const chatIA = async (mensaje, modo = 'asistente', contexto = '') => {
  try {
    const response = await api.post('/api/ia/chat', { mensaje, modo, contexto });
    return response.data;
  } catch (error) {
    console.error('Error en chat IA:', error);
    return { success: false, message: 'Error al procesar la solicitud' };
  }
};

// Analizar equipo
export const analizarEquipoIA = async (descripcion) => {
  try {
    const response = await api.post('/api/ia/analizar-equipo', { descripcion });
    return response.data;
  } catch (error) {
    console.error('Error al analizar equipo:', error);
    return { success: false, message: 'Error al analizar el equipo' };
  }
};

// Resumir servicio
export const resumirServicioIA = async (data) => {
  try {
    const response = await api.post('/api/ia/resumir-servicio', data);
    return response.data;
  } catch (error) {
    console.error('Error al resumir servicio:', error);
    return { success: false, message: 'Error al generar el resumen' };
  }
};

// Sugerir repuestos
export const sugerirRepuestosIA = async (diagnostico) => {
  try {
    const response = await api.post('/api/ia/sugerir-repuestos', { diagnostico });
    return response.data;
  } catch (error) {
    console.error('Error al sugerir repuestos:', error);
    return { success: false, message: 'Error al sugerir repuestos' };
  }
};

// backend/src/services/ia.service.js - agregar esta función

// Chat con contexto o sin contexto según modo
const chatConModo = async (userId, mensaje, modo = 'asistente', tecnico_id = null) => {
    try {
        let promptSistema = '';
        let datos = null;
        let toolUsada = null;

        if (modo === 'asistente') {
            // Modo asistente: con contexto, memoria y tools
            const intencion = detectarIntencion(mensaje);
            
            if (intencion.tool && tools[intencion.tool]) {
                let params = { ...intencion.params };
                if (tecnico_id) {
                    params.tecnico_id = tecnico_id;
                }
                datos = await tools[intencion.tool](params);
                toolUsada = intencion.tool;
            }

            promptSistema = `
                Eres un asistente personal experto en servicios tecnicos.
                Tu objetivo es ayudar al usuario a hacer su trabajo correctamente.
                Tienes acceso al sistema y puedes consultar informacion en tiempo real.
            `;

            if (datos) {
                promptSistema += `\n\nDatos del sistema:\n${JSON.stringify(datos, null, 2)}`;
            }

            // Agregar historial
            const sesion = getSesion(userId);
            if (sesion.historial.length > 0) {
                const ultimos = sesion.historial.slice(-6);
                promptSistema += `\n\nHistorial reciente:`;
                ultimos.forEach(h => {
                    promptSistema += `\n[${h.role}]: ${h.content.substring(0, 100)}`;
                });
            }

        } else {
            // Modo consulta: sin contexto, sin memoria, sin tools
            promptSistema = `
                Eres un asistente de consulta rapida. Responde preguntas especificas de forma directa y concisa.
                No utilices contexto del usuario, no hagas seguimiento. Solo responde la pregunta puntual.
            `;
        }

        const response = await ollama.chat({
            model: MODEL,
            messages: [
                { role: 'system', content: promptSistema },
                { role: 'user', content: mensaje }
            ]
        });

        // Solo guardar historial en modo asistente
        if (modo === 'asistente') {
            const sesion = getSesion(userId);
            sesion.historial.push(
                { role: 'user', content: mensaje },
                { role: 'assistant', content: response.message.content }
            );
            sesion.ultimaActividad = Date.now();
        }

        return { 
            success: true, 
            respuesta: response.message.content,
            tool: toolUsada,
            datos: datos,
            modo: modo
        };
    } catch (error) {
        console.error('Error en chat con modo:', error);
        return { success: false, error: error.message };
    }
};
// Asistencia técnica rápida
export const asistenciaTecnicaIA = async (pregunta) => {
  try {
    const response = await api.post('/api/ia/asistencia', { pregunta });
    return response.data;
  } catch (error) {
    console.error('Error en asistencia técnica:', error);
    return { success: false, message: 'Error al procesar la asistencia' };
  }
};