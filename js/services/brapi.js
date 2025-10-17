// js/services/brapi.js

/**
 * Módulo de serviço para buscar cotações de ativos.
 * ATENÇÃO: A fonte de dados foi alterada para uma API pública mais estável
 * que não requer chave de autenticação.
 */

// Este endpoint é mais estável e formata a resposta como JSON de forma consistente.
const API_BASE_URL = 'https://query2.finance.yahoo.com/v1/finance/screener';

// Usamos um proxy para contornar problemas de CORS.
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

/**
 * Busca as cotações mais recentes para uma lista de tickers.
 * @param {Array<string>} tickers - Um array de tickers de ativos (ex: ['PETR4', 'MGLU3']).
 * @returns {Promise<object>} Um objeto mapeando cada ticker ao seu preço atual. Ex: { "PETR4": 29.50, "MGLU3": 2.10 }.
 */
export async function getQuotes(tickers) {
    if (!tickers || tickers.length === 0) {
        return {};
    }

    // A API do Yahoo Finance requer o sufixo ".SA" para ações brasileiras.
    const tickersWithSuffix = tickers.map(ticker => `${ticker}.SA`);
    const tickerString = tickersWithSuffix.join(',');

    // A URL para esta API é mais complexa, mas mais confiável.
    const screenerUrl = `${API_BASE_URL}?crumb=4KKSb22bYgU&lang=en-US&region=US&formatted=true&corsDomain=finance.yahoo.com&quotes=${tickerString}`;
    const url = `${CORS_PROXY}${encodeURIComponent(screenerUrl)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`A API de cotações respondeu com o status: ${response.status}`);
        }

        const data = await response.json();
        const yahooData = JSON.parse(data.contents);

        if (!yahooData || !yahooData.finance || !yahooData.finance.result || !yahooData.finance.result[0] || !yahooData.finance.result[0].quotes) {
            console.warn("Resposta da API de cotações em formato inesperado:", yahooData);
            return {};
        }

        const quotesArray = yahooData.finance.result[0].quotes;
        const quotesMap = quotesArray.reduce((map, quote) => {
            if (quote && quote.symbol && quote.regularMarketPrice) {
                const originalTicker = quote.symbol.replace('.SA', '');
                map[originalTicker] = quote.regularMarketPrice;
            }
            return map;
        }, {});

        return quotesMap;

    } catch (error) {
        console.error("Erro ao buscar cotações da nova API:", error);
        return {};
    }
}
