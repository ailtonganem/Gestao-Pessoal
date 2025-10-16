// js/modules/investments/main.js

/**
 * Ponto de entrada para o Módulo de Investimentos.
 * Este arquivo é responsável por inicializar todas as funcionalidades
 * do módulo, como o registro de event listeners.
 */

import { initializeInvestmentEventListeners } from './handlers.js';

/**
 * Inicializa todo o Módulo de Investimentos.
 * Esta função deve ser chamada uma vez quando a aplicação principal é carregada.
 */
export function initializeInvestmentsModule() {
    initializeInvestmentEventListeners();
}
