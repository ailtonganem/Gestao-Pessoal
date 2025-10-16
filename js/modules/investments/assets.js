// js/modules/investments/assets.js

/**
 * Módulo para gerenciar a lógica de negócio dos ativos (ações, FIIs, etc.)
 * dentro de uma carteira de investimentos.
 */

import { db } from '../../firebase-config.js';
import { COLLECTIONS } from '../../config/constants.js';
import {
    collection,
    addDoc,
    query,
    getDocs,
    Timestamp,
    orderBy
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Adiciona um novo ativo a uma carteira específica.
 * @param {string} portfolioId - O ID do documento da carteira pai.
 * @param {object} assetData - Dados do novo ativo.
 * @returns {Promise<DocumentReference>}
 */
export async function addAsset(portfolioId, assetData) {
    if (!portfolioId) {
        throw new Error("ID da carteira é obrigatório para adicionar um ativo.");
    }
    if (!assetData.name || !assetData.ticker) {
        throw new Error("Nome e Ticker do ativo são obrigatórios.");
    }

    try {
        // Cria uma referência para a subcoleção 'assets' dentro da carteira específica.
        const assetsRef = collection(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId, 'assets');

        const dataToSave = {
            ...assetData,
            // Inicializa os campos que serão calculados posteriormente
            quantity: 0,
            averagePrice: 0,
            totalInvested: 0,
            currentValue: 0,
            createdAt: Timestamp.now()
        };

        return await addDoc(assetsRef, dataToSave);

    } catch (error) {
        console.error("Erro ao adicionar ativo:", error);
        throw new Error("Não foi possível salvar o novo ativo.");
    }
}

/**
 * Busca todos os ativos de uma carteira específica.
 * @param {string} portfolioId - O ID do documento da carteira.
 * @returns {Promise<Array<object>>} Uma lista de objetos de ativo.
 */
export async function getAssets(portfolioId) {
    if (!portfolioId) {
        console.warn("getAssets chamado sem um portfolioId.");
        return [];
    }

    try {
        const assetsRef = collection(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId, 'assets');
        const q = query(assetsRef, orderBy("name"));

        const querySnapshot = await getDocs(q);
        const assets = [];
        querySnapshot.forEach((doc) => {
            assets.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return assets;

    } catch (error) {
        console.error("Erro ao buscar ativos:", error);
        throw new Error("Não foi possível carregar os ativos da carteira.");
    }
}
