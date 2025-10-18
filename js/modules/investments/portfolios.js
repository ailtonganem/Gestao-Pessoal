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
    deleteDoc,
    updateDoc,
    // INÍCIO DA ALTERAÇÃO
    writeBatch
    // FIM DA ALTERAÇÃO
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAssets } from './assets.js';

/**
 * Adiciona uma nova carteira de investimentos para o usuário e uma conta de investimento associada.
 * @param {object} portfolioData - Dados da nova carteira.
 * @param {string} portfolioData.name - Nome da carteira.
 * @param {string} [portfolioData.description] - Descrição opcional.
 * @param {string} portfolioData.userId - ID do usuário.
 * @param {string} portfolioData.ownershipType - 'own' ou 'third-party'.
 * @returns {Promise<void>}
 */
export async function addPortfolio(portfolioData) {
    if (!portfolioData.name || portfolioData.name.trim() === '') {
        throw new Error("O nome da carteira é obrigatório.");
    }

    const batch = writeBatch(db);

    try {
        // 1. Prepara a criação da carteira
        const portfoliosRef = collection(db, COLLECTIONS.INVESTMENT_PORTFOLIOS);
        const newPortfolioRef = doc(portfoliosRef); // Gera a referência para a nova carteira
        
        const dataToSave = {
            userId: portfolioData.userId,
            name: portfolioData.name.trim(),
            description: portfolioData.description.trim() || "",
            ownershipType: portfolioData.ownershipType, // 'own' or 'third-party'
            totalInvested: 0,
            currentValue: 0,
            createdAt: Timestamp.now()
        };
        batch.set(newPortfolioRef, dataToSave);

        // 2. Prepara a criação da conta de investimento associada
        const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
        const newAccountRef = doc(accountsRef); // Gera a referência para a nova conta
        
        const accountData = {
            name: `Caixa - ${portfolioData.name.trim()}`,
            initialBalance: 0,
            currentBalance: 0,
            type: 'investment', // Novo tipo para identificar a conta
            portfolioId: newPortfolioRef.id, // Vincula a conta à carteira
            userId: portfolioData.userId,
            createdAt: Timestamp.now()
        };
        batch.set(newAccountRef, accountData);
        
        // 3. Executa as duas operações atomicamente
        await batch.commit();

    } catch (error) {
        console.error("Erro ao adicionar carteira e conta de investimento:", error);
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

/**
 * Atualiza os dados de uma carteira de investimentos.
 * @param {string} portfolioId - O ID da carteira a ser atualizada.
 * @param {object} updatedData - Os novos dados (ex: { name, description }).
 * @returns {Promise<void>}
 */
export async function updatePortfolio(portfolioId, updatedData) {
    if (!portfolioId) {
        throw new Error("ID da carteira é obrigatório para atualização.");
    }
    try {
        const portfolioDocRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId);
        await updateDoc(portfolioDocRef, updatedData);
    } catch (error) {
        console.error("Erro ao atualizar carteira:", error);
        throw new Error("Não foi possível salvar as alterações da carteira.");
    }
}

/**
 * Exclui uma carteira de investimentos do Firestore.
 * @param {string} portfolioId - O ID do documento da carteira a ser excluída.
 * @returns {Promise<void>}
 */
export async function deletePortfolio(portfolioId) {
    try {
        // Futuramente: Adicionar lógica para excluir subcoleções (ativos, movimentos)
        // e a conta de investimento associada antes de excluir o documento principal da carteira.
        const portfolioDocRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId);
        await deleteDoc(portfolioDocRef);
    } catch (error) {
        console.error("Erro ao excluir carteira:", error);
        throw new Error("Não foi possível excluir a carteira.");
    }
}

/**
 * Busca todos os ativos de todas as carteiras de um usuário.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<Array<object>>} Uma lista consolidada de todos os ativos do usuário,
 *                                  com cada ativo contendo a propriedade 'portfolioId'.
 */
export async function getAllUserAssets(userId) {
    try {
        const allUserPortfolios = await getPortfolios(userId);
        
        // Mapeia cada carteira para uma promessa que busca seus ativos,
        // sem filtrar por tipo de carteira.
        const allAssetsPromises = allUserPortfolios.map(async (p) => {
            const assets = await getAssets(p.id);
            // Adiciona o ID da carteira a cada ativo antes de retornar
            return assets.map(asset => ({
                ...asset,
                portfolioId: p.id 
            }));
        });

        const assetsByPortfolio = await Promise.all(allAssetsPromises);
        
        // "Achata" o array de arrays em um único array de ativos
        const consolidatedAssets = assetsByPortfolio.flat();
        
        return consolidatedAssets;
    } catch (error) {
        console.error("Erro ao buscar todos os ativos do usuário:", error);
        throw new Error("Não foi possível carregar a visão consolidada dos ativos.");
    }
}
