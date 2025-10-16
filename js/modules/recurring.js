// js/modules/recurring.js

// Importa a instância do Firestore e funções necessárias.
import { db } from '../firebase-config.js';
import { COLLECTIONS } from '../config/constants.js';
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
    updateDoc,
    increment
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { findOrCreateInvoice } from './invoices.js';
import { updateBalanceInBatch } from './accounts.js';


/**
 * Adiciona uma nova configuração de transação recorrente no Firestore.
 * @param {object} recurringData - Dados da recorrência.
 * @param {string} recurringData.paymentMethod - 'account_debit' ou 'credit_card'.
 * @param {string|null} recurringData.accountId - ID da conta se o método for 'account_debit'.
 * @param {string|null} recurringData.cardId - ID do cartão se o método for 'credit_card'.
 * @returns {Promise<DocumentReference>}
 */
async function addRecurringTransaction(recurringData) {
    try {
        const recurringRef = collection(db, COLLECTIONS.RECURRING_TRANSACTIONS);
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
        const recurringRef = collection(db, COLLECTIONS.RECURRING_TRANSACTIONS);
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
        const docRef = doc(db, COLLECTIONS.RECURRING_TRANSACTIONS, recurringId);
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
        const docRef = doc(db, COLLECTIONS.RECURRING_TRANSACTIONS, recurringId);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Erro ao excluir transação recorrente:", error);
        throw new Error("Não foi possível excluir a recorrência.");
    }
}

/**
 * Verifica as recorrências de um usuário e cria as transações que venceram no mês atual.
 * @param {string} userId - O ID do usuário.
 * @param {Array<object>} userCreditCards - Lista de cartões de crédito do usuário.
 * @returns {Promise<number>} O número de transações que foram criadas.
 */
async function processRecurringTransactions(userId, userCreditCards) {
    const recurringTxs = await getRecurringTransactions(userId);
    if (recurringTxs.length === 0) {
        return 0;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    const transactionsToProcess = recurringTxs.filter(tx => {
        const lastProcessedDate = tx.lastProcessed ? tx.lastProcessed.toDate() : null;
        const hasBeenProcessedThisMonth = lastProcessedDate &&
                                         lastProcessedDate.getFullYear() === currentYear &&
                                         lastProcessedDate.getMonth() === currentMonth;
        return !hasBeenProcessedThisMonth && tx.dayOfMonth <= now.getDate();
    });

    if (transactionsToProcess.length === 0) {
        return 0;
    }

    const batch = writeBatch(db);
    let transactionsCreated = 0;

    for (const tx of transactionsToProcess) {
        const transactionDate = new Date(currentYear, currentMonth, tx.dayOfMonth);

        if (tx.paymentMethod === 'credit_card' && tx.cardId) {
            const card = userCreditCards.find(c => c.id === tx.cardId);
            if (!card) {
                console.error(`Cartão ${tx.cardId} da recorrência "${tx.description}" não encontrado.`);
                continue;
            }

            const invoiceId = await findOrCreateInvoice(card.id, card, userId, transactionDate);
            const invoiceRef = doc(db, COLLECTIONS.INVOICES, invoiceId);
            const invoiceTransactionRef = doc(collection(invoiceRef, COLLECTIONS.INVOICE_TRANSACTIONS));

            const newInvoiceTxData = {
                description: tx.description,
                amount: tx.amount,
                category: tx.category,
                purchaseDate: Timestamp.fromDate(transactionDate),
                createdAt: Timestamp.now(),
                isRecurring: true
            };
            batch.set(invoiceTransactionRef, newInvoiceTxData);
            batch.update(invoiceRef, { totalAmount: increment(tx.amount) });
        
        } else { // 'account_debit' or legacy
            if (!tx.accountId) {
                console.error(`Conta da recorrência "${tx.description}" não encontrada.`);
                continue;
            }
            const newTransactionRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
            const newTransactionData = {
                description: tx.description,
                amount: tx.amount,
                type: tx.type,
                category: tx.category,
                paymentMethod: 'debit',
                date: Timestamp.fromDate(transactionDate),
                createdAt: Timestamp.now(),
                userId: userId,
                accountId: tx.accountId,
                isRecurring: true
            };
            batch.set(newTransactionRef, newTransactionData);
            updateBalanceInBatch(batch, tx.accountId, tx.amount, tx.type);
        }

        // Marca a recorrência como processada para o mês atual.
        const recurringDocRef = doc(db, COLLECTIONS.RECURRING_TRANSACTIONS, tx.id);
        batch.update(recurringDocRef, { lastProcessed: Timestamp.now() });
        
        transactionsCreated++;
    }

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
