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
    orderBy,
    doc,
    deleteDoc,
    // INÍCIO DA ALTERAÇÃO
    updateDoc
    // FIM DA ALTERAÇÃO
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

// INÍCIO DA ALTERAÇÃO
/**
 * Atualiza os dados de um ativo.
 * @param {string} portfolioId - O ID da carteira pai.
 * @param {string} assetId - O ID do ativo a ser atualizado.
 * @param {object} updatedData - Os novos dados do ativo.
 * @returns {Promise<void>}
 */
export async function updateAsset(portfolioId, assetId, updatedData) {
    if (!portfolioId || !assetId) {
        throw new Error("ID da carteira e do ativo são obrigatórios para a atualização.");
    }
    try {
        const assetDocRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId, 'assets', assetId);
        await updateDoc(assetDocRef, updatedData);
    } catch (error) {
        console.error("Erro ao atualizar ativo:", error);
        throw new Error("Não foi possível salvar as alterações do ativo.");
    }
}
// FIM DA ALTERAÇÃO

/**
 * Exclui um ativo de uma carteira específica.
 * @param {string} portfolioId - O ID da carteira pai.
 * @param {string} assetId - O ID do ativo a ser excluído.
 * @returns {Promise<void>}
 */
export async function deleteAsset(portfolioId, assetId) {
    if (!portfolioId || !assetId) {
        throw new Error("ID da carteira e do ativo são obrigatórios para a exclusão.");
    }
    try {
        const assetDocRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId, 'assets', assetId);
        await deleteDoc(assetDocRef);
    } catch (error) {
        console.error("Erro ao excluir ativo:", error);
        throw new Error("Não foi possível excluir o ativo.");
    }
}
