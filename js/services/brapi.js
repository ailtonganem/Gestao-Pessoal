// js/services/brapi.js

/**
 * Módulo de serviço para interagir com a API da Brapi (https://brapi.dev/).
 * Responsável por buscar cotações de ativos do mercado brasileiro.
 */

import { brapiApiToken } from '../firebase-config.js'; // Importa o token de autenticação

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

    // Verifica se o token foi configurado.
    if (!brapiApiToken || brapiApiToken === "5yemombtoQBbWAQRzE3pS5") {
        console.error("Token da Brapi API não configurado no arquivo firebase-config.js. As cotações não serão atualizadas.");
        // Retorna um objeto vazio para não quebrar a aplicação.
        return {};
    }

    // A API permite buscar múltiplos tickers de uma vez, separados por vírgula.
    const tickerString = tickers.join(',');
    // Adiciona o token como um parâmetro de consulta na URL.
    const url = `${API_BASE_URL}/quote/${tickerString}?token=${brapiApiToken}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            // O erro 401 (Não autorizado) é comum se o token for inválido.
            if (response.status === 401) {
                 console.error("Erro de autenticação com a Brapi API. Verifique se o seu token está correto no arquivo firebase-config.js.");
            }
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
            if (quote && quote.symbol && !quote.error && quote.regularMarketPrice) {
                map[quote.symbol] = quote.regularMarketPrice;
            }
            return map;
        }, {});

        return quotesMap;

    } catch (error) {
        console.error("Erro ao buscar cotações da Brapi API:", error);
        // Em caso de erro, retorna um objeto vazio para não quebrar a aplicação.
        return {};
    }
}
