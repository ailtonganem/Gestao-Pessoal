// js/services/brapi.js

/**
 * Módulo de serviço para buscar cotações de ativos.
 * ATENÇÃO: A fonte de dados foi alterada da Brapi para uma API pública que consome dados
 * do Yahoo Finance, para evitar a necessidade de uma chave de API (token).
 */

const API_URL_BASE = 'https://query1.finance.yahoo.com/v7/finance/quote';
// Usamos um proxy público para contornar problemas de CORS (Cross-Origin Resource Sharing)
// ao fazer a chamada do navegador diretamente para a API do Yahoo Finance.
const CORS_PROXY = 'https://api.allorigins.win/get?url=';


/**
 * Busca as cotações mais recentes para uma lista de tickers.
 * @param {Array<string>} tickers - Um array de tickers de ativos (ex: ['PETR4', 'MGLU3']).
 * @returns {Promise<object>} Um objeto mapeando cada ticker ao seu preço atual. Ex: { "PETR4": 29.50, "MGLU3": 2.10 }.
 */
export async function getQuotes(tickers) {
    if (!tickers || tickers.length === 0) {
        return {}; // Retorna um objeto vazio se nenhum ticker for fornecido.
    }

    // A API do Yahoo Finance requer o sufixo ".SA" para ações brasileiras.
    const tickersWithSuffix = tickers.map(ticker => `${ticker}.SA`);
    const tickerString = tickersWithSuffix.join(',');

    // Monta a URL final, passando a URL da API do Yahoo pelo proxy.
    const url = `${CORS_PROXY}${encodeURIComponent(`${API_URL_BASE}?symbols=${tickerString}`)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`A API de cotações respondeu com o status: ${response.status}`);
        }

        const data = await response.json();
        
        // O proxy envolve a resposta original em um campo "contents".
        // Precisamos extrair e converter essa string JSON para um objeto.
        const yahooData = JSON.parse(data.contents);
        
        // --- INÍCIO DA ALTERAÇÃO ---
        // Verificação robusta para a estrutura da resposta e para erros internos da API.
        if (!yahooData || !yahooData.quoteResponse) {
            console.warn("Resposta da API de cotações em formato inesperado (sem quoteResponse):", yahooData);
            return {};
        }

        if (yahooData.quoteResponse.error) {
            console.error("Erro retornado pela API de cotações:", yahooData.quoteResponse.error.description || yahooData.quoteResponse.error);
            return {};
        }

        if (!yahooData.quoteResponse.result) {
            console.warn("Resposta da API de cotações em formato inesperado (sem result):", yahooData);
            return {};
        }
        // --- FIM DA ALTERAÇÃO ---

        // Transforma o array de resultados em um objeto de mapa para fácil acesso (ticker -> preço).
        const quotesMap = yahooData.quoteResponse.result.reduce((map, quote) => {
            if (quote && quote.symbol && quote.regularMarketPrice) {
                // Remove o sufixo ".SA" para que a chave do objeto seja o ticker original (ex: "PETR4").
                const originalTicker = quote.symbol.replace('.SA', '');
                map[originalTicker] = quote.regularMarketPrice;
            }
            return map;
        }, {});

        return quotesMap;

    } catch (error) {
        console.error("Erro ao buscar cotações da API pública:", error);
        // Em caso de erro, retorna um objeto vazio para não quebrar a aplicação.
        return {};
    }
}
