// src/pages/Dashboard/Agenda.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import multimonthPlugin from '@fullcalendar/multimonth';
import HorarioConfigModal from './agenda/HorarioConfigModal';
import AgendarModal from './agenda/AgendarModal';
import DisponibilidadPanel from './agenda/DisponibilidadPanel';
import { Calendar as CalendarIcon, Settings, Clock, Users, Loader2 } from 'lucide-react';

const Agenda = () => {
  const { user } = useAuth();
  const calendarRef = useRef(null);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showHorarioModal, setShowHorarioModal] = useState(false);
  const [showAgendarModal, setShowAgendarModal] = useState(false);
  const [selectedTecnico, setSelectedTecnico] = useState(null);
  const [selectedServicio, setSelectedServicio] = useState(null);
  const [currentView, setCurrentView] = useState('timeGridDay');
  const [tecnicosList, setTecnicosList] = useState([]);

  const userRole = user?.rol || 'usuario';
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    fetchEventos();
    fetchTecnicos();
  }, [selectedDate, currentView]);

  const fetchEventos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (currentView === 'dayGridMonth') {
        const start = new Date(selectedDate);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        params.append('fechaInicio', start.toISOString().split('T')[0]);
        params.append('fechaFin', end.toISOString().split('T')[0]);
      } else {
        params.append('fechaInicio', selectedDate);
        params.append('fechaFin', selectedDate);
      }
      
      const res = await api.get(`/api/agenda/eventos?${params.toString()}`);
      setEventos(res.data || []);
    } catch (error) {
      console.error('Error fetching eventos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTecnicos = async () => {
    try {
      const res = await api.get('/api/users?rol=tecnico');
      setTecnicosList(res.data || []);
    } catch (error) {
      console.error('Error fetching tecnicos:', error);
    }
  };

  const handleDateSelect = (selectInfo) => {
    if (!isAdmin) return;
    setSelectedDate(selectInfo.startStr.split('T')[0]);
    // Aquí se podría abrir modal para agendar un servicio nuevo
  };

  const handleEventClick = (clickInfo) => {
    const evento = clickInfo.event;
    setSelectedServicio({
      id: evento.id,
      codigo_os: evento.title.split(' - ')[0]
    });
    setShowAgendarModal(true);
  };

  const handleEventDrop = async (dropInfo) => {
    const evento = dropInfo.event;
    const nuevaFecha = dropInfo.event.startStr.split('T')[0];
    const nuevaHora = dropInfo.event.startStr.split('T')[1]?.slice(0,5) || '09:00';
    
    try {
      await api.put(`/api/agenda/servicio/${evento.id}`, {
        fecha_agendada: nuevaFecha,
        hora_inicio: nuevaHora,
        duracion_estimada: 60
      });
      await fetchEventos();
    } catch (error) {
      console.error('Error moving event:', error);
      dropInfo.revert();
    }
  };

  const handleConfigHorario = (tecnico) => {
    setSelectedTecnico(tecnico);
    setShowHorarioModal(true);
  };

  const getTipoVista = () => {
    if (currentView === 'dayGridMonth') return 'dayGridMonth';
    if (currentView === 'timeGridWeek') return 'timeGridWeek';
    return 'timeGridDay';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agenda de Técnicos</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gestiona horarios y disponibilidad de los técnicos
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentView('timeGridDay')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              currentView === 'timeGridDay'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            Día
          </button>
          <button
            onClick={() => setCurrentView('timeGridWeek')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              currentView === 'timeGridWeek'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setCurrentView('dayGridMonth')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              currentView === 'dayGridMonth'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            Mes
          </button>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendario */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          {loading ? (
            <div className="flex justify-center items-center h-96">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, multimonthPlugin]}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: ''
              }}
              initialView={getTipoVista()}
              events={eventos}
              selectable={isAdmin}
              selectMirror={true}
              editable={isAdmin}
              droppable={isAdmin}
              select={handleDateSelect}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              locale="es"
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              allDaySlot={false}
              height={600}
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                meridiem: false,
                hour12: false
              }}
              titleFormat={{
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }}
              buttonText={{
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día'
              }}
            />
          )}
        </div>

        {/* Panel Lateral */}
        <div className="space-y-6">
          {/* Técnicos */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4" />
                Técnicos
              </h3>
              {isAdmin && (
                <button
                  onClick={() => {
                    if (tecnicosList.length > 0) {
                      setSelectedTecnico(tecnicosList[0]);
                      setShowHorarioModal(true);
                    }
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Configurar horarios
                </button>
              )}
            </div>
            <div className="space-y-2">
              {tecnicosList.map(tecnico => (
                <div
                  key={tecnico.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => handleConfigHorario(tecnico)}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {tecnico.nombre1} {tecnico.apellidos || ''}
                    </span>
                  </div>
                  <Settings className="w-4 h-4 text-gray-400 hover:text-blue-500" />
                </div>
              ))}
            </div>
          </div>

          {/* Disponibilidad */}
          <DisponibilidadPanel 
            fecha={selectedDate}
            onSelectTecnico={(tecnico) => {
              console.log('Técnico seleccionado:', tecnico);
            }}
          />
        </div>
      </div>

      {/* Modales */}
      <HorarioConfigModal
        isOpen={showHorarioModal}
        onClose={() => {
          setShowHorarioModal(false);
          setSelectedTecnico(null);
        }}
        tecnicoId={selectedTecnico?.id}
        tecnicoNombre={`${selectedTecnico?.nombre1 || ''} ${selectedTecnico?.apellidos || ''}`}
        onSave={fetchTecnicos}
      />

      <AgendarModal
        isOpen={showAgendarModal}
        onClose={() => {
          setShowAgendarModal(false);
          setSelectedServicio(null);
        }}
        servicioId={selectedServicio?.id}
        servicioCodigo={selectedServicio?.codigo_os}
        onSave={fetchEventos}
      />
    </div>
  );
};

export default Agenda;