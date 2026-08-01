// frontend/src/components/ui/IAChat.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, X, Sparkles, Trash2, Search, UserCog } from 'lucide-react';
import { chatIA } from '../../services/ia.service';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const IAChat = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modo, setModo] = useState('asistente');
  const [contexto, setContexto] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Función handleKeyPress
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Función limpiarHistorial
  const limpiarHistorial = async () => {
    try {
      await api.post('/api/ia/limpiar');
      setMessages([]);
      if (modo === 'asistente') {
        const resumen = await generarResumenInicial();
        setMessages([{ role: 'assistant', content: resumen }]);
      } else {
        setMessages([{ role: 'assistant', content: 'Modo consulta activo. Haz tu pregunta.' }]);
      }
    } catch (err) {
      console.error('Error limpiando historial:', err);
    }
  };

  // Función generarResumenInicial
  const generarResumenInicial = async () => {
    try {
      const res = await api.get('/api/ia/alertas');
      const alertas = res.data.data || [];
      const nombre = user?.nombre1 || 'Usuario';
      const hora = new Date().getHours();
      const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

      let resumen = `${saludo} ${nombre}. Soy tu asistente personal.\n\n`;

      const pendientes = alertas.find(a => a.tipo === 'pendientes');
      const hoy = alertas.find(a => a.tipo === 'hoy');
      const vencimientos = alertas.find(a => a.tipo === 'vencimiento');
      const stats = alertas.find(a => a.tipo === 'resumen');

      if (pendientes && pendientes.data && pendientes.data.length > 0) {
        resumen += `Pendientes: ${pendientes.data.length} servicios por atender.\n`;
        pendientes.data.slice(0, 3).forEach(s => {
          resumen += `  - ${s.codigo_os}: ${s.cliente_nombre} (${s.estado})\n`;
        });
        if (pendientes.data.length > 3) {
          resumen += `  - ... y ${pendientes.data.length - 3} más\n`;
        }
        resumen += '\n';
      } else {
        resumen += `No tienes servicios pendientes.\n\n`;
      }

      if (hoy && hoy.data && hoy.data.length > 0) {
        resumen += `Servicios para hoy: ${hoy.data.length}\n`;
        hoy.data.forEach(s => {
          const horaStr = s.hora_inicio_agendada ? ` a las ${s.hora_inicio_agendada}` : '';
          resumen += `  - ${s.codigo_os}: ${s.cliente_nombre}${horaStr}\n`;
        });
        resumen += '\n';
      }

      if (vencimientos && vencimientos.data && vencimientos.data.length > 0) {
        resumen += `Alquileres por vencer en 3 días: ${vencimientos.data.length}\n`;
        vencimientos.data.forEach(s => {
          const fecha = new Date(s.fecha_fin).toLocaleDateString('es-CO');
          resumen += `  - ${s.numero_solicitud}: ${s.cliente_nombre} (vence ${fecha})\n`;
        });
        resumen += '\n';
      }

      if (stats && stats.data) {
        resumen += `Resumen del día:\n`;
        resumen += `  - Total servicios: ${stats.data.total || 0}\n`;
        resumen += `  - Pendientes: ${stats.data.pendientes || 0}\n`;
        resumen += `  - En ejecución: ${stats.data.en_ejecucion || 0}\n`;
        resumen += `  - Completados: ${stats.data.cerradas || 0}\n`;
        resumen += `  - Agendados hoy: ${stats.data.agendadas_hoy || 0}\n`;
      }

      resumen += `\nPuedes preguntarme sobre tus servicios, clientes o pedirme ayuda con tus tareas.`;
      resumen += `\nUsa el modo Consulta para preguntas puntuales.`;

      return resumen;
    } catch (error) {
      console.error('Error generando resumen inicial:', error);
      return `Hola ${user?.nombre1 || 'Usuario'}, soy tu asistente personal. ¿En qué puedo ayudarte hoy?`;
    }
  };

  // Función cargarContexto
  const cargarContexto = async () => {
    try {
      const res = await api.get('/api/ia/contexto');
      if (res.data.success) {
        setContexto(res.data.data);
      }

      if (messages.length === 0 && modo === 'asistente') {
        const resumen = await generarResumenInicial();
        setMessages([{ role: 'assistant', content: resumen }]);
      } else if (messages.length === 0 && modo === 'consulta') {
        setMessages([{ role: 'assistant', content: 'Modo consulta activo. Puedes hacer preguntas específicas y obtendrás respuestas directas.' }]);
      }
    } catch (err) {
      console.error('Error cargando contexto:', err);
      if (messages.length === 0) {
        const nombre = user?.nombre1 || 'Usuario';
        setMessages([{ role: 'assistant', content: `Hola ${nombre}, soy tu asistente personal. ¿En qué puedo ayudarte hoy?` }]);
      }
    }
  };

  // Función cambiarModo
  const cambiarModo = (nuevoModo) => {
    setModo(nuevoModo);
    setMessages([]);
    setError(null);
    setTimeout(() => cargarContexto(), 100);
  };

  // Función handleSend
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    setError(null);

    try {
      const response = await chatIA(userMessage, modo, contexto || '');

      if (response?.success) {
        const respuesta =
          response?.data?.respuesta ??
          response?.respuesta;

        if (!respuesta) {
          console.error('Respuesta de IA sin contenido:', response);
          setError('La IA respondió, pero no devolvió contenido');
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: respuesta,
          },
        ]);
      } else {
        console.error('La solicitud de IA fue rechazada:', response);
        setError(
          response?.message ||
          response?.error ||
          response?.data?.message ||
          response?.data?.error ||
          'Error al procesar la solicitud'
        );
      }
    } catch (err) {
      console.error('Error no controlado en IAChat:', err);
      setError(
        err?.message ||
        'Error de conexión con el servidor'
      );
    } finally {
      setLoading(false);
    }
  };

  // Efectos
  useEffect(() => {
    if (isOpen) {
      cargarContexto();
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={chatContainerRef}
        className="bg-white dark:bg-gray-900 w-full max-w-[500px] h-[95vh] sm:h-[90vh] max-h-[700px] rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - más compacto */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${modo === 'asistente'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500'
                  : 'bg-gradient-to-r from-gray-500 to-gray-700'
                }`}>
                {modo === 'asistente' ? (
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                ) : (
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
                    {modo === 'asistente' ? 'Asistente Personal' : 'Modo Consulta'}
                  </h3>
                </div>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.nombre1 || 'Usuario'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={limpiarHistorial}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-red-500"
                title="Limpiar historial"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* Selector de modo - más compacto */}
          <div className="flex items-center gap-1.5 mt-2 sm:mt-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => cambiarModo('asistente')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${modo === 'asistente'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
            >
              <UserCog className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Asistente</span>
            </button>
            <button
              onClick={() => cambiarModo('consulta')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${modo === 'consulta'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
            >
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Consulta</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4 bg-gray-50 dark:bg-gray-800/30 min-h-[200px]">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 sm:gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''
                }`}
            >
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user'
                  ? 'bg-blue-100 dark:bg-blue-900/30'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500'
                }`}>
                {msg.role === 'user' ? (
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                )}
              </div>
              <div
                className={`max-w-[80%] sm:max-w-[85%] px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm ${msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-tl-sm border border-gray-200 dark:border-gray-700'
                  }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed break-words">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
              <div className="bg-white dark:bg-gray-900 px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl rounded-tl-sm border border-gray-200 dark:border-gray-700">
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-blue-500" />
              </div>
            </div>
          )}
          {error && (
            <div className="text-center text-red-500 text-xs sm:text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
              {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input - fijo abajo */}
        <div className="flex-shrink-0 px-3 sm:px-4 py-2 sm:py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={modo === 'asistente'
                ? 'Escribe tu mensaje...'
                : 'Escribe tu consulta...'}
              className="flex-1 px-3 py-2 sm:px-4 sm:py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center min-w-[36px] sm:min-w-[44px]"
            >
              {loading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
          <div className="flex justify-between text-[8px] sm:text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 sm:mt-2">
            <span>
              {messages.length} mensajes
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IAChat;