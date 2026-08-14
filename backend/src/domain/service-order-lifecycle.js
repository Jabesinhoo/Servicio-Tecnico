'use strict';

const SERVICE_ORDER_STATES = Object.freeze({
  PENDIENTE: 'pendiente',
  APROBADO: 'aprobado',
  RECHAZADO: 'rechazado',
  ASIGNADA: 'asignada',
  EN_EJECUCION: 'en_ejecucion',
  EN_ESPERA: 'en_espera',
  CANCELADO: 'cancelado',
  CERRADA: 'cerrada',
});

const TERMINAL_STATES = Object.freeze([
  SERVICE_ORDER_STATES.RECHAZADO,
  SERVICE_ORDER_STATES.CANCELADO,
  SERVICE_ORDER_STATES.CERRADA,
]);

const TRANSITIONS = Object.freeze({
  [SERVICE_ORDER_STATES.PENDIENTE]: [
    SERVICE_ORDER_STATES.APROBADO,
    SERVICE_ORDER_STATES.RECHAZADO,
    SERVICE_ORDER_STATES.CANCELADO,
  ],

  [SERVICE_ORDER_STATES.APROBADO]: [
    SERVICE_ORDER_STATES.ASIGNADA,
    SERVICE_ORDER_STATES.CANCELADO,
  ],

  [SERVICE_ORDER_STATES.ASIGNADA]: [
    SERVICE_ORDER_STATES.EN_EJECUCION,
    SERVICE_ORDER_STATES.CANCELADO,
  ],

  [SERVICE_ORDER_STATES.EN_EJECUCION]: [
    SERVICE_ORDER_STATES.EN_ESPERA,
    SERVICE_ORDER_STATES.CERRADA,
    SERVICE_ORDER_STATES.CANCELADO,
  ],

  [SERVICE_ORDER_STATES.EN_ESPERA]: [
    SERVICE_ORDER_STATES.EN_EJECUCION,
    SERVICE_ORDER_STATES.CANCELADO,
  ],

  [SERVICE_ORDER_STATES.RECHAZADO]: [],
  [SERVICE_ORDER_STATES.CANCELADO]: [],
  [SERVICE_ORDER_STATES.CERRADA]: [],
});

const isValidState = (state) => {
  return Object.values(SERVICE_ORDER_STATES).includes(state);
};

const canTransition = (currentState, nextState) => {
  if (!isValidState(currentState) || !isValidState(nextState)) {
    return false;
  }

  return TRANSITIONS[currentState]?.includes(nextState) || false;
};

const isTerminalState = (state) => {
  return TERMINAL_STATES.includes(state);
};

module.exports = {
  SERVICE_ORDER_STATES,
  TRANSITIONS,
  TERMINAL_STATES,
  isValidState,
  canTransition,
  isTerminalState,
};