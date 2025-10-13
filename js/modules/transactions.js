// Importa a instância do Firestore.
import { db } from '../firebase-config.js';
// Importa a lógica de faturas.
import { findOrCreateInvoice } from './invoices.js';

// Importa as funções do Firestore necessárias.
import {
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    getDocs,
    orderBy,
    doc,
    deleteDoc,
    updateDoc,
    writeBatch,
    increment,
    Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Adiciona um novo documento de transação.
 * Se for cartão de crédito, associa a uma fatura.
 * @param {object} transactionData - Os dados da transação.
 * @param {object|null} cardData - Dados do cartão de crédito, se aplicável.
 * @returns {Promise<void>}
 */
async function addTransaction(transactionData, cardData = null) {
    if (transactionData.paymentMethod === 'credit_card' && cardData) {
        try {
            const transactionDate = new Date();
            const invoiceId = await findOrCreateInvoice(transactionData.cardId, cardData, transactionData.userId, transactionDate);
            const invoiceRef = doc(db, 'invoices', invoiceId);
            const invoiceTransactionsRef = collection(invoiceRef, 'transactions');
            const batch = writeBatch(db);
            const newTransactionInInvoice = {
                description: transactionData.description,
                amount: transactionData.amount,
                category: transactionData.category,
                createdAt: serverTimestamp()
            };
            const newTransactionRef = doc(invoiceTransactionsRef);
            batch.set(newTransactionRef, newTransactionInInvoice);
            batch.update(invoiceRef, { totalAmount: increment(transactionData.amount) });
            await batch.commit();
        } catch (error) {
            console.error("Erro ao adicionar transação de crédito:", error);
            throw new Error("Não foi possível salvar a transação no cartão.");
        }
    } else {
        try {
            const transactionsCollectionRef = collection(db, 'transactions');
            await addDoc(transactionsCollectionRef, { ...transactionData, createdAt: serverTimestamp() });
        } catch (error) {
            console.error("Erro ao adicionar transação:", error);
            throw new Error("Não foi possível salvar a transação.");
        }
    }
}

// INÍCIO DA ALTERAÇÃO
/**
 * Busca todas as transações de fluxo de caixa de um usuário, com filtros opcionais de data.
 * @param {string} userId - O ID do usuário.
 * @param {object} filters - Objeto com os filtros.
 * @param {number|null} filters.month - O mês para filtrar (1-12).
 * @param {number|null} filters.year - O ano para filtrar.
 * @returns {Promise<Array>} Uma lista de objetos de transação.
 */
async function getTransactions(userId, filters = {}) {
    const { month, year } = filters;
    try {
        const transactionsCollectionRef = collection(db, 'transactions');
        
        // Constrói a base da consulta
        let queryConstraints = [
            where("userId", "==", userId),
            where("paymentMethod", "!=", "credit_card")
        ];

        // Adiciona filtros de data se fornecidos
        if (year && month && month !== 'all') {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59); // Último dia do mês
            
            queryConstraints.push(where("createdAt", ">=", Timestamp.fromDate(startDate)));
            queryConstraints.push(where("createdAt", "<=", Timestamp.fromDate(endDate)));
        } else if (year) {
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);

            queryConstraints.push(where("createdAt", ">=", Timestamp.fromDate(startDate)));
            queryConstraints.push(where("createdAt", "<=", Timestamp.fromDate(endDate)));
        }

        // Adiciona a ordenação
        // O Firestore exige que a primeira ordenação seja no campo da primeira desigualdade ou filtro de range
        if(year) {
            queryConstraints.push(orderBy("createdAt", "desc"));
            queryConstraints.push(orderBy("paymentMethod"));
        } else {
            queryConstraints.push(orderBy("paymentMethod"));
            queryConstraints.push(orderBy("createdAt", "desc"));
        }

        const q = query(transactionsCollectionRef, ...queryConstraints);
        
        const querySnapshot = await getDocs(q);
        const transactions = [];
        querySnapshot.forEach((doc) => {
            transactions.push({ id: doc.id, ...doc.data() });
        });
        return transactions;
    } catch (error) {
        console.error("Erro ao buscar transações:", error);
        throw new Error("Não foi possível buscar as transações.");
    }
}
// FIM DA ALTERAÇÃO

async function deleteTransaction(transactionId) {
    try {
        const transactionDocRef = doc(db, 'transactions', transactionId);
        await deleteDoc(transactionDocRef);
    } catch (error) {
        console.error("Erro ao excluir transação:", error);
        throw new Error("Não foi possível excluir a transação.");
    }
}

async function updateTransaction(transactionId, updatedData) {
    try {
        const transactionDocRef = doc(db, 'transactions', transactionId);
        await updateDoc(transactionDocRef, updatedData);
    } catch (error) {
        console.error("Erro ao atualizar transação:", error);
        throw new Error("Não foi possível salvar as alterações.");
    }
}

export { addTransaction, getTransactions, deleteTransaction, updateTransaction };
