// js/services/brapi.js

/**
 * Módulo de serviço para buscar cotações de ativos.
 * ATENÇÃO: A fonte de dados foi alterada para uma API que utiliza dados do Google Finance,
 * para garantir estabilidade e evitar a necessidade de uma chave de API (token).
 */

// Este endpoint público não oficial costuma ser muito confiável e não exige chave.
const API_URL_BASE = 'https://finance.google.com/finance/info?client=ig&q='; 

/**
 * Busca as cotações mais recentes para uma lista de tickers.
 * @param {Array<string>} tickers - Um array de tickers de ativos (ex: ['PETR4', 'MGLU3', 'MXRF11']).
 * @returns {Promise<object>} Um objeto mapeando cada ticker ao seu preço atual. Ex: { "PETR4": 29.50, "MGLU3": 2.10 }.
 */
export async function getQuotes(tickers) {
    if (!tickers || tickers.length === 0) {
        return {}; // Retorna um objeto vazio se nenhum ticker for fornecido.
    }

    // O Google Finance usa o padrão "B3:TICKER" para o mercado brasileiro.
    const symbols = tickers.map(ticker => `B3:${ticker}`).join(',');

    // A API retorna um JSON envolto em um callback (JSONP), que o `fetch` pode ter dificuldade em processar.
    // Usaremos um proxy para limpar a resposta e garantir que o navegador possa ler o JSON puro.
    const url = `https://api.allorigins.win/get?url=${encodeURIComponent(`${API_URL_BASE}${symbols}`)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`A API de cotações respondeu com o status: ${response.status}`);
        }

        const rawData = await response.json();
        
        // A resposta original vem como string: `// [ { ...dados } ]`
        // 1. Remove os caracteres iniciais `//` e faz o parse.
        const cleanJsonString = rawData.contents.trim().replace(/^\/\//, '').trim();
        const quotesArray = JSON.parse(cleanJsonString);

        if (!Array.isArray(quotesArray)) {
            console.warn("Resposta da API de cotações em formato inesperado (não é um array):", rawData.contents);
            return {};
        }

        const quotesMap = quotesArray.reduce((map, quote) => {
            // Verifica se a cotação é válida e se tem a propriedade 'l_cur' (Last Price)
            if (quote && quote.t && quote.l_cur) {
                // Remove o prefixo "B3:" e obtém o preço como float
                const originalTicker = quote.t.replace('B3:', '');
                const price = parseFloat(quote.l_cur.replace(',', '.')); // Garante que o separador decimal seja o ponto

                if (!isNaN(price) && price > 0) {
                     map[originalTicker] = price;
                }
            }
            return map;
        }, {});

        return quotesMap;

    } catch (error) {
        console.error("Erro ao buscar cotações do Google Finance API:", error);
        return {};
    }
}
