// js/modules/recurring.js

// Importa a instância do Firestore e funções necessárias.
import { db } from '../firebase-config.js';
// INÍCIO DA ALTERAÇÃO - Importa as constantes de coleções
import { COLLECTIONS } from '../config/constants.js';
// FIM DA ALTERAÇÃO
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    where,
    orderBy,
    Timestamp,
    writeBatch,
    updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Adiciona uma nova configuração de transação recorrente no Firestore.
 * @param {object} recurringData - Dados da recorrência.
 * @returns {Promise<DocumentReference>}
 */
async function addRecurringTransaction(recurringData) {
    try {
        // INÍCIO DA ALTERAÇÃO
        const recurringRef = collection(db, COLLECTIONS.RECURRING_TRANSACTIONS);
        // FIM DA ALTERAÇÃO
        return await addDoc(recurringRef, {
            ...recurringData,
            createdAt: Timestamp.now(),
            lastProcessed: null // Inicia como nulo para indicar que nunca foi processada.
        });
    } catch (error) {
        console.error("Erro ao adicionar transação recorrente:", error);
        throw new Error("Não foi possível salvar a nova recorrência.");
    }
}

/**
 * Busca todas as configurações de transações recorrentes de um usuário.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<Array<object>>}
 */
async function getRecurringTransactions(userId) {
    try {
        // INÍCIO DA ALTERAÇÃO
        const recurringRef = collection(db, COLLECTIONS.RECURRING_TRANSACTIONS);
        // FIM DA ALTERAÇÃO
        const q = query(
            recurringRef,
            where("userId", "==", userId),
            orderBy("dayOfMonth")
        );
        const querySnapshot = await getDocs(q);
        const transactions = [];
        querySnapshot.forEach((doc) => {
            transactions.push({ id: doc.id, ...doc.data() });
        });
        return transactions;
    } catch (error) {
        console.error("Erro ao buscar transações recorrentes:", error);
        throw new Error("Não foi possível carregar as recorrências.");
    }
}

/**
 * Atualiza uma configuração de transação recorrente.
 * @param {string} recurringId - O ID da recorrência a ser atualizada.
 * @param {object} updatedData - Os novos dados para a recorrência.
 * @returns {Promise<void>}
 */
async function updateRecurringTransaction(recurringId, updatedData) {
    try {
        // INÍCIO DA ALTERAÇÃO
        const docRef = doc(db, COLLECTIONS.RECURRING_TRANSACTIONS, recurringId);
        // FIM DA ALTERAÇÃO
        await updateDoc(docRef, updatedData);
    } catch (error) {
        console.error("Erro ao atualizar transação recorrente:", error);
        throw new Error("Não foi possível salvar as alterações da recorrência.");
    }
}

/**
 * Exclui uma configuração de transação recorrente.
 * @param {string} recurringId - O ID da recorrência a ser excluída.
 * @returns {Promise<void>}
 */
async function deleteRecurringTransaction(recurringId) {
    try {
        // INÍCIO DA ALTERAÇÃO
        const docRef = doc(db, COLLECTIONS.RECURRING_TRANSACTIONS, recurringId);
        // FIM DA ALTERAÇÃO
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Erro ao excluir transação recorrente:", error);
        throw new Error("Não foi possível excluir a recorrência.");
    }
}

/**
 * Verifica as recorrências de um usuário e cria as transações que venceram no mês atual.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<number>} O número de transações que foram criadas.
 */
async function processRecurringTransactions(userId) {
    const recurringTxs = await getRecurringTransactions(userId);
    if (recurringTxs.length === 0) {
        return 0;
    }

    const batch = writeBatch(db);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    let transactionsCreated = 0;

    recurringTxs.forEach(tx => {
        const lastProcessedDate = tx.lastProcessed ? tx.lastProcessed.toDate() : null;
        const hasBeenProcessedThisMonth = lastProcessedDate &&
                                         lastProcessedDate.getFullYear() === currentYear &&
                                         lastProcessedDate.getMonth() === currentMonth;

        // Se já foi processada neste mês, ou o dia de lançamento ainda não chegou, pula.
        if (hasBeenProcessedThisMonth || tx.dayOfMonth > now.getDate()) {
            return;
        }

        // Cria a nova transação
        const transactionDate = new Date(currentYear, currentMonth, tx.dayOfMonth);
        const newTransactionData = {
            description: tx.description,
            amount: tx.amount,
            type: tx.type,
            category: tx.category,
            paymentMethod: 'debit', // Lançamentos automáticos são como débito em conta
            date: Timestamp.fromDate(transactionDate),
            createdAt: Timestamp.now(),
            userId: userId,
            isRecurring: true // Flag para identificar a origem
        };
        
        // INÍCIO DA ALTERAÇÃO
        const newTransactionRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
        // FIM DA ALTERAÇÃO
        batch.set(newTransactionRef, newTransactionData);

        // Marca a recorrência como processada para o mês atual.
        // INÍCIO DA ALTERAÇÃO
        const recurringDocRef = doc(db, COLLECTIONS.RECURRING_TRANSACTIONS, tx.id);
        // FIM DA ALTERAÇÃO
        batch.update(recurringDocRef, { lastProcessed: Timestamp.now() });
        
        transactionsCreated++;
    });

    if (transactionsCreated > 0) {
        await batch.commit();
        console.log(`${transactionsCreated} transação(ões) recorrente(s) foram criadas.`);
    }

    return transactionsCreated;
}

export {
    addRecurringTransaction,
    getRecurringTransactions,
    deleteRecurringTransaction,
    updateRecurringTransaction,
    processRecurringTransactions
};
