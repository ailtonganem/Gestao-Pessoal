// js/services/brapi.js

/**
 * Módulo de serviço para interagir com a API da Brapi (https://brapi.dev/).
 * Responsável por buscar cotações de ativos do mercado brasileiro.
 */

const API_BASE_URL = 'https://brapi.dev/api';

/**
 * Busca as cotações mais recentes para uma lista de tickers.
 * @param {Array<string>} tickers - Um array de tickers de ativos (ex: ['PETR4', 'MGLU3']).
 * @returns {Promise<object>} Um objeto mapeando cada ticker ao seu preço atual. Ex: { "PETR4": 29.50, "MGLU3": 2.10 }.
 */
export async function getQuotes(tickers) {
    if (!tickers || tickers.length === 0) {
        return {}; // Retorna um objeto vazio se nenhum ticker for fornecido.
    }

    // A API permite buscar múltiplos tickers de uma vez, separados por vírgula.
    const tickerString = tickers.join(',');
    const url = `${API_BASE_URL}/quote/${tickerString}?range=1d&interval=1d&fundamental=false`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`A API de cotações respondeu com o status: ${response.status}`);
        }

        const data = await response.json();
        
        // Verifica se a resposta contém os resultados esperados.
        if (!data || !data.results) {
            console.warn("Resposta da API de cotações em formato inesperado:", data);
            return {};
        }

        // Transforma o array de resultados em um objeto de mapa para fácil acesso (ticker -> preço).
        const quotesMap = data.results.reduce((map, quote) => {
            // A API retorna 'error: true' para tickers não encontrados.
            if (quote && quote.symbol && !quote.error) {
                map[quote.symbol] = quote.regularMarketPrice;
            }
            return map;
        }, {});

        return quotesMap;

    } catch (error) {
        console.error("Erro ao buscar cotações da Brapi API:", error);
        // Em caso de erro, retorna um objeto vazio para não quebrar a aplicação.
        // A notificação de erro pode ser tratada por quem chama a função, se necessário.
        return {};
    }
}
