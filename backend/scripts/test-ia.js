// backend/scripts/test-ia.js
require('dotenv').config();
const iaService = require('../src/services/ia.service');

async function testIA() {
    console.log('🧪 Probando IA con Ollama...\n');

    // 1. Verificar conexión
    console.log('1. Verificando conexión con Ollama:');
    const conexion = await iaService.verificarConexion();
    if (conexion.success) {
        console.log('✅ Conexión exitosa:', conexion.message);
    } else {
        console.log('❌ Error de conexión:', conexion.error);
        return;
    }
    console.log('');

    // 2. Chat simple
    console.log('2. Chat simple:');
    const chat = await iaService.chat('¿Qué es un servicio técnico?');
    console.log('Respuesta:', chat.respuesta || chat.error);
    console.log('');

    // 3. Análisis de equipo
    console.log('3. Análisis de equipo:');
    const analisis = await iaService.analizarEquipo('El equipo no enciende, no muestra ningún LED ni sonido.');
    if (analisis.success) {
        console.log('Problema:', analisis.data.problema);
        console.log('Causas:', analisis.data.posiblesCausas);
        console.log('Soluciones:', analisis.data.soluciones);
        console.log('Repuestos:', analisis.data.repuestosNecesarios);
        console.log('Dificultad:', analisis.data.nivelDificultad);
    } else {
        console.log('Error:', analisis.error);
    }
    console.log('');

    // 4. Asistencia técnica
    console.log('4. Asistencia técnica:');
    const asistencia = await iaService.asistenciaTecnica('¿Cómo revisar la fuente de poder de un PC?');
    console.log('Respuesta:', asistencia.respuesta || asistencia.error);
}

testIA();