// js/modules/budget.js

// Importa a instância do Firestore e funções necessárias.
import { db } from '../firebase-config.js';
// INÍCIO DA ALTERAÇÃO - Correção para caminho relativo
import { COLLECTIONS } from '../config/constants.js';
// FIM DA ALTERAÇÃO
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    orderBy
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Cria ou atualiza o orçamento para uma categoria específica de um usuário.
 * O ID do documento é o nome da categoria para garantir que haja apenas um orçamento por categoria.
 * @param {object} budgetData - Dados do orçamento.
 * @param {string} budgetData.userId - O ID do usuário.
 * @param {string} budgetData.category - O nome da categoria.
 * @param {number} budgetData.amount - O valor do orçamento.
 * @returns {Promise<void>}
 */
async function setBudget(budgetData) {
    try {
        // Usamos um ID de documento composto para garantir unicidade e facilitar a busca.
        const budgetDocId = `${budgetData.userId}_${budgetData.category}`;
        const budgetDocRef = doc(db, COLLECTIONS.BUDGETS, budgetDocId);
        
        await setDoc(budgetDocRef, {
            userId: budgetData.userId,
            category: budgetData.category,
            amount: budgetData.amount
        });
    } catch (error) {
        console.error("Erro ao definir orçamento:", error);
        throw new Error("Não foi possível salvar o orçamento.");
    }
}

/**
 * Busca todos os orçamentos definidos por um usuário.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<Array<object>>} Uma lista de objetos de orçamento.
 */
async function getBudgets(userId) {
    try {
        const budgetsRef = collection(db, COLLECTIONS.BUDGETS);
        const q = query(
            budgetsRef,
            where("userId", "==", userId),
            orderBy("category")
        );
        const querySnapshot = await getDocs(q);
        const budgets = [];
        querySnapshot.forEach((doc) => {
            budgets.push({
                id: doc.id,
                ...doc.data()
            });
        });
        return budgets;
    } catch (error) {
        console.error("Erro ao buscar orçamentos:", error);
        throw new Error("Não foi possível carregar os orçamentos.");
    }
}

/**
 * Exclui o orçamento de uma categoria específica.
 * @param {string} budgetId - O ID do documento de orçamento a ser excluído.
 * @returns {Promise<void>}
 */
async function deleteBudget(budgetId) {
    try {
        const budgetDocRef = doc(db, COLLECTIONS.BUDGETS, budgetId);
        await deleteDoc(budgetDocRef);
    } catch (error) {
        console.error("Erro ao excluir orçamento:", error);
        throw new Error("Não foi possível excluir o orçamento.");
    }
}

export { setBudget, getBudgets, deleteBudget };
