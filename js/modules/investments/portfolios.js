// js/modules/investments/portfolios.js

/**
 * Módulo para gerenciar a lógica de negócio das carteiras de investimento.
 * Inclui funções para criar, ler, atualizar e deletar carteiras no Firestore.
 */

import { db } from '../../firebase-config.js';
import { COLLECTIONS } from '../../config/constants.js';
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    Timestamp,
    orderBy,
    doc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Adiciona uma nova carteira de investimentos para o usuário.
 * @param {object} portfolioData - Dados da nova carteira.
 * @param {string} portfolioData.name - Nome da carteira.
 * @param {string} [portfolioData.description] - Descrição opcional.
 * @param {string} portfolioData.userId - ID do usuário.
 * @returns {Promise<DocumentReference>}
 */
export async function addPortfolio(portfolioData) {
    if (!portfolioData.name || portfolioData.name.trim() === '') {
        throw new Error("O nome da carteira é obrigatório.");
    }

    try {
        const portfoliosRef = collection(db, COLLECTIONS.INVESTMENT_PORTFOLIOS);
        
        const dataToSave = {
            userId: portfolioData.userId,
            name: portfolioData.name.trim(),
            description: portfolioData.description.trim() || "",
            totalInvested: 0,
            currentValue: 0,
            createdAt: Timestamp.now()
        };
        
        return await addDoc(portfoliosRef, dataToSave);

    } catch (error) {
        console.error("Erro ao adicionar carteira:", error);
        throw new Error("Não foi possível criar a nova carteira.");
    }
}

/**
 * Busca todas as carteiras de um usuário específico.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<Array<object>>} Uma lista de objetos de carteira.
 */
export async function getPortfolios(userId) {
    try {
        const portfoliosRef = collection(db, COLLECTIONS.INVESTMENT_PORTFOLIOS);
        const q = query(
            portfoliosRef,
            where("userId", "==", userId),
            orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);
        const portfolios = [];
        querySnapshot.forEach((doc) => {
            portfolios.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return portfolios;

    } catch (error) {
        console.error("Erro ao buscar carteiras:", error);
        throw new Error("Não foi possível carregar suas carteiras de investimento.");
    }
}

// INÍCIO DA ALTERAÇÃO

/**
 * Exclui uma carteira de investimentos do Firestore.
 * @param {string} portfolioId - O ID do documento da carteira a ser excluída.
 * @returns {Promise<void>}
 */
export async function deletePortfolio(portfolioId) {
    try {
        // Futuramente: Adicionar lógica para excluir subcoleções (ativos, movimentos)
        // antes de excluir o documento principal da carteira.
        const portfolioDocRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId);
        await deleteDoc(portfolioDocRef);
    } catch (error) {
        console.error("Erro ao excluir carteira:", error);
        throw new Error("Não foi possível excluir a carteira.");
    }
}
// FIM DA ALTERAÇÃO
