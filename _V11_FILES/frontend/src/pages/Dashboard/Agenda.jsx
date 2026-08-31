import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import multimonthPlugin from '@fullcalendar/multimonth';
import HorarioConfigModal from './agenda/HorarioConfigModal';
import DisponibilidadPanel from './agenda/DisponibilidadPanel';
import {
  Calendar as CalendarIcon,
  Settings,
  Users,
  Loader2,
  RefreshCw,
  Filter,
  CheckSquare,
  Square,
} from 'lucide-react';

function localDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const Agenda = () => {
  const { user } = useAuth();
  const calendarRef = useRef(null);

  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] =
    useState(localDate());
  const [showHorarioModal, setShowHorarioModal] =
    useState(false);
  const [selectedTecnico, setSelectedTecnico] =
    useState(null);
  const [currentView, setCurrentView] =
    useState(
      window.innerWidth < 768
        ? 'timeGridDay'
        : 'timeGridWeek'
    );
  const [tecnicosList, setTecnicosList] =
    useState([]);
  const [visibleTechnicians, setVisibleTechnicians] =
    useState([]);
  const [mobile, setMobile] =
    useState(window.innerWidth < 768);
  const [error, setError] = useState('');

  const userRole =
    user?.role?.name || user?.rol || 'usuario';
  const isAdmin = userRole === 'admin';

  const fetchTecnicos = useCallback(async () => {
    try {
      const response = await api.get(
        '/api/usuarios/role/tecnico'
      );

      const rows = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      const active = rows.filter(
        (item) => item.activo !== false
      );

      setTecnicosList(active);

      setVisibleTechnicians((previous) => {
        if (previous.length > 0) return previous;
        return active.map((item) => item.id);
      });
    } catch (requestError) {
      console.error(
        'Error fetching technicians:',
        requestError
      );
    }
  }, []);

  const calendarRange = useMemo(() => {
    if (currentView === 'dayGridMonth') {
      const date = new Date(
        `${selectedDate}T12:00:00`
      );
      const start = new Date(
        date.getFullYear(),
        date.getMonth(),
        1
      );
      const end = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0
      );

      const fmt = (value) =>
        new Intl.DateTimeFormat('en-CA', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(value);

      return {
        start: fmt(start),
        end: fmt(end),
      };
    }

    if (currentView === 'timeGridWeek') {
      const date = new Date(
        `${selectedDate}T12:00:00`
      );
      const day = date.getDay();
      const mondayOffset =
        day === 0 ? -6 : 1 - day;

      const start = new Date(date);
      start.setDate(date.getDate() + mondayOffset);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const fmt = (value) =>
        new Intl.DateTimeFormat('en-CA', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(value);

      return {
        start: fmt(start),
        end: fmt(end),
      };
    }

    return {
      start: selectedDate,
      end: selectedDate,
    };
  }, [currentView, selectedDate]);

  const fetchEventos = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get(
        '/api/agenda/eventos',
        {
          params: {
            fechaInicio: calendarRange.start,
            fechaFin: calendarRange.end,
          },
        }
      );

      const rows = Array.isArray(response.data)
        ? response.data
        : [];

      setEventos(
        isAdmin
          ? rows.filter((event) =>
              visibleTechnicians.includes(
                event.extendedProps?.tecnico_id
              )
            )
          : rows
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'No fue posible cargar la agenda'
      );
    } finally {
      setLoading(false);
    }
  }, [
    calendarRange,
    visibleTechnicians,
    isAdmin,
  ]);

  useEffect(() => {
    fetchTecnicos();
  }, [fetchTecnicos]);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

  useEffect(() => {
    const interval = window.setInterval(
      fetchEventos,
      60_000
    );

    return () => window.clearInterval(interval);
  }, [fetchEventos]);

  useEffect(() => {
    const onResize = () => {
      const nextMobile =
        window.innerWidth < 768;
      setMobile(nextMobile);

      if (
        nextMobile &&
        currentView !== 'timeGridDay'
      ) {
        setCurrentView('timeGridDay');
      }
    };

    window.addEventListener('resize', onResize);
    return () =>
      window.removeEventListener('resize', onResize);
  }, [currentView]);

  useEffect(() => {
    const apiInstance =
      calendarRef.current?.getApi?.();

    if (apiInstance) {
      apiInstance.changeView(currentView);
    }
  }, [currentView]);

  const toggleTechnician = (id) => {
    setVisibleTechnicians((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const handleDatesSet = (info) => {
    const center = new Date(
      (
        info.view.currentStart ||
        info.start
      ).getTime()
    );

    center.setDate(
      center.getDate() +
        Math.floor(
          (
            (info.view.currentEnd || info.end) -
            (info.view.currentStart || info.start)
          ) /
            86_400_000 /
            2
        )
    );

    setSelectedDate(
      new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(center)
    );
  };

  const handleEventDrop = async (dropInfo) => {
    if (!isAdmin) {
      dropInfo.revert();
      return;
    }

    const serviceOrderId =
      dropInfo.event.extendedProps
        ?.service_order_id;

    if (!serviceOrderId) {
      dropInfo.revert();
      return;
    }

    const start = dropInfo.event.start;

    const date = new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }
    ).format(start);

    const time = new Intl.DateTimeFormat(
      'en-GB',
      {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }
    ).format(start);

    const duration =
      Math.max(
        15,
        Math.round(
          (
            dropInfo.event.end -
            dropInfo.event.start
          ) /
            60_000
        )
      ) || 60;

    try {
      await api.put(
        `/api/agenda/servicio/${serviceOrderId}`,
        {
          fecha_agendada: date,
          hora_inicio: time,
          duracion_estimada: duration,
        }
      );

      await fetchEventos();
    } catch (requestError) {
      window.alert(
        requestError.response?.data?.message ||
          'No se pudo mover el servicio porque el nuevo horario genera conflicto.'
      );

      dropInfo.revert();
    }
  };

  const getView = () =>
    mobile ? 'timeGridDay' : currentView;

  return (
    <div className="responsive-page min-w-0 space-y-4 sm:space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 shrink-0" />
            Agenda de Técnicos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cada OS bloquea automáticamente a todos sus técnicos durante el horario asignado.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!mobile && (
            <>
              <button
                onClick={() =>
                  setCurrentView('timeGridDay')
                }
                className={`min-h-10 px-3 rounded-lg text-sm font-semibold ${
                  currentView === 'timeGridDay'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}
              >
                Día
              </button>
              <button
                onClick={() =>
                  setCurrentView('timeGridWeek')
                }
                className={`min-h-10 px-3 rounded-lg text-sm font-semibold ${
                  currentView === 'timeGridWeek'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() =>
                  setCurrentView('dayGridMonth')
                }
                className={`min-h-10 px-3 rounded-lg text-sm font-semibold ${
                  currentView === 'dayGridMonth'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}
              >
                Mes
              </button>
            </>
          )}

          <button
            onClick={fetchEventos}
            className="min-h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 font-semibold text-sm flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 sm:gap-6">
        <div className="min-w-0 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-2 sm:p-4 overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-[60dvh] sm:h-[620px]">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="min-w-0 overflow-x-auto">
              <div className={mobile ? 'min-w-[640px]' : 'min-w-0'}>
                <FullCalendar
                  ref={calendarRef}
                  plugins={[
                    dayGridPlugin,
                    timeGridPlugin,
                    interactionPlugin,
                    multimonthPlugin,
                  ]}
                  initialView={getView()}
                  events={eventos}
                  datesSet={handleDatesSet}
                  editable={isAdmin}
                  eventStartEditable={isAdmin}
                  eventDurationEditable={false}
                  eventDrop={handleEventDrop}
                  locale="es"
                  slotMinTime="06:00:00"
                  slotMaxTime="22:00:00"
                  allDaySlot={false}
                  height={mobile ? 620 : 680}
                  stickyHeaderDates
                  nowIndicator
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: '',
                  }}
                  eventTimeFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  }}
                  buttonText={{
                    today: 'Hoy',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          {isAdmin && (
            <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Técnicos visibles
                </h3>

                <button
                  type="button"
                  onClick={() => {
                    if (
                      visibleTechnicians.length ===
                      tecnicosList.length
                    ) {
                      setVisibleTechnicians([]);
                    } else {
                      setVisibleTechnicians(
                        tecnicosList.map(
                          (tech) => tech.id
                        )
                      );
                    }
                  }}
                  className="text-xs font-semibold text-blue-600"
                >
                  {visibleTechnicians.length ===
                  tecnicosList.length
                    ? 'Ocultar todos'
                    : 'Mostrar todos'}
                </button>
              </div>

              <div className="mt-3 max-h-64 overflow-y-auto overscroll-contain space-y-1">
                {tecnicosList.map((tech) => {
                  const checked =
                    visibleTechnicians.includes(
                      tech.id
                    );

                  return (
                    <div
                      key={tech.id}
                      className="flex items-center gap-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          toggleTechnician(tech.id)
                        }
                        className="flex-1 min-h-10 px-2 text-left flex items-center gap-2"
                      >
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400 shrink-0" />
                        )}
                        <span className="text-sm truncate">
                          {tech.nombre1}{' '}
                          {tech.apellidos || ''}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTecnico(tech);
                          setShowHorarioModal(true);
                        }}
                        className="w-10 h-10 flex items-center justify-center"
                        title="Configurar horario"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <DisponibilidadPanel
            fecha={selectedDate}
            onSelectTecnico={() => {}}
          />
        </aside>
      </div>

      <HorarioConfigModal
        isOpen={showHorarioModal}
        onClose={() => {
          setShowHorarioModal(false);
          setSelectedTecnico(null);
        }}
        tecnicoId={selectedTecnico?.id}
        tecnicoNombre={`${selectedTecnico?.nombre1 || ''} ${selectedTecnico?.apellidos || ''}`}
        onSave={async () => {
          await fetchTecnicos();
          await fetchEventos();
        }}
      />
    </div>
  );
};

export default Agenda;
