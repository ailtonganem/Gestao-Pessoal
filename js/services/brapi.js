// js/services/brapi.js

/**
 * Módulo de serviço para buscar cotações de ativos.
 * ATENÇÃO: A busca automática foi desativada temporariamente.
 * Esta função agora retorna um objeto vazio para não quebrar a aplicação,
 * enquanto a entrada manual de cotações é utilizada.
 */

/**
 * Busca as cotações mais recentes para uma lista de tickers.
 * @param {Array<string>} tickers - Um array de tickers de ativos (ex: ['PETR4', 'MGLU3']).
 * @returns {Promise<object>} Um objeto vazio, pois a funcionalidade está desativada.
 */
export async function getQuotes(tickers) {
    // A funcionalidade de busca automática de cotações está desativada.
    // Retorna uma promessa resolvida com um objeto vazio para garantir que
    // o resto do código que chama esta função não quebre.
    console.warn("A busca automática de cotações foi desativada. Os valores devem ser inseridos manualmente.");
    return Promise.resolve({});
}
