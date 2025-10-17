// js/modules/investments/quotes.js

/**
 * Módulo para gerenciar o armazenamento e a recuperação
 * dos dados de cotação dos ativos no Firestore.
 */

import { db } from '../../firebase-config.js';
import { COLLECTIONS } from '../../config/constants.js';
import {
    collection,
    doc,
    getDocs,
    writeBatch
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Busca todos os dados de cotação salvos para os ativos de um usuário.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<object>} Um objeto mapeando cada ticker (ex: "PETR4") aos seus dados salvos.
 */
export async function getSavedQuotes(userId) {
    const quotesMap = {};
    if (!userId) return quotesMap;

    try {
        const quotesRef = collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.ASSET_QUOTES);
        const querySnapshot = await getDocs(quotesRef);
        
        querySnapshot.forEach((doc) => {
            // A ID do documento é o próprio ticker do ativo
            quotesMap[doc.id] = doc.data();
        });

        return quotesMap;
    } catch (error) {
        console.error("Erro ao buscar cotações salvas:", error);
        // Retorna um objeto vazio em caso de erro para não quebrar a aplicação.
        return {};
    }
}

/**
 * Salva ou atualiza os dados de cotação para múltiplos ativos de uma só vez.
 * @param {string} userId - O ID do usuário.
 * @param {Array<object>} quotesData - Um array de objetos, cada um contendo o ticker e os dados a serem salvos.
 *                                     Ex: [{ ticker: 'PETR4', currentPrice: 29.50, dyValue: 1.20, ... }]
 * @returns {Promise<void>}
 */
export async function saveQuotes(userId, quotesData) {
    if (!userId || !quotesData || quotesData.length === 0) {
        return;
    }

    const batch = writeBatch(db);
    const quotesRef = collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.ASSET_QUOTES);

    quotesData.forEach(data => {
        // Usa o ticker do ativo como ID do documento para garantir que cada ativo tenha apenas um registro de cotação.
        const assetDocRef = doc(quotesRef, data.ticker);
        
        // Remove o ticker do objeto de dados, pois ele já está sendo usado como ID.
        const dataToSave = { ...data };
        delete dataToSave.ticker;

        // Adiciona a operação ao batch (cria se não existir, atualiza se já existir).
        batch.set(assetDocRef, dataToSave, { merge: true });
    });

    try {
        await batch.commit();
    } catch (error) {
        console.error("Erro ao salvar cotações em lote:", error);
        throw new Error("Não foi possível salvar os dados de cotação.");
    }
}
