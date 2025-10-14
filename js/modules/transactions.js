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
 * Converte uma string de data (YYYY-MM-DD) para um objeto Date do JS na timezone local.
 * @param {string} dateString - A data no formato "YYYY-MM-DD".
 * @returns {Date}
 */
function parseDateString(dateString) {
    // Adiciona T00:00:00 para evitar problemas de fuso horário que podem alterar o dia.
    return new Date(dateString + 'T00:00:00');
}

/**
 * Adiciona um novo documento de transação.
 * Se for cartão de crédito, associa a uma fatura.
 * @param {object} transactionData - Os dados da transação.
 * @param {object|null} cardData - Dados do cartão de crédito, se aplicável.
 * @returns {Promise<void>}
 */
async function addTransaction(transactionData, cardData = null) {
    // Converte a string de data do formulário para um objeto Date.
    const transactionDate = parseDateString(transactionData.date);

    if (transactionData.paymentMethod === 'credit_card' && cardData) {
        try {
            // Usa a data fornecida pelo usuário para encontrar a fatura correta.
            const invoiceId = await findOrCreateInvoice(transactionData.cardId, cardData, transactionData.userId, transactionDate);
            const invoiceRef = doc(db, 'invoices', invoiceId);
            const invoiceTransactionsRef = collection(invoiceRef, 'transactions');
            const batch = writeBatch(db);
            
            // O lançamento na fatura usa o serverTimestamp para ordenação interna.
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
            // Prepara os dados para salvar, incluindo o novo campo 'date' como Timestamp.
            const dataToSave = {
                ...transactionData,
                date: Timestamp.fromDate(transactionDate), // Campo principal para data da transação
                createdAt: serverTimestamp() // Mantido para auditoria
            };
            await addDoc(transactionsCollectionRef, dataToSave);
        } catch (error) {
            console.error("Erro ao adicionar transação:", error);
            throw new Error("Não foi possível salvar a transação.");
        }
    }
}

/**
 * Busca as transações de fluxo de caixa de um usuário (excluindo lançamentos de cartão de crédito)
 * com filtros opcionais de data. O filtro agora é feito no campo 'date'.
 * @param {string} userId - O ID do usuário.
 * @param {object} filters - Objeto com os filtros.
 * @param {number|string} filters.month - O mês para filtrar (1-12 ou 'all').
 * @param {number} filters.year - O ano para filtrar.
 * @returns {Promise<Array>} Uma lista de objetos de transação.
 */
async function getTransactions(userId, filters = {}) {
    const { month, year } = filters;
    try {
        const transactionsCollectionRef = collection(db, 'transactions');
        
        let queryConstraints = [
            where("userId", "==", userId),
            where("paymentMethod", "!=", "credit_card")
        ];

        if (year && month && month !== 'all') {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            
            // INÍCIO DA ALTERAÇÃO - Filtra pelo campo 'date'
            queryConstraints.push(where("date", ">=", Timestamp.fromDate(startDate)));
            queryConstraints.push(where("date", "<=", Timestamp.fromDate(endDate)));
            // FIM DA ALTERAÇÃO
        } else if (year) {
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);
            
            // INÍCIO DA ALTERAÇÃO - Filtra pelo campo 'date'
            queryConstraints.push(where("date", ">=", Timestamp.fromDate(startDate)));
            queryConstraints.push(where("date", "<=", Timestamp.fromDate(endDate)));
            // FIM DA ALTERAÇÃO
        }
        
        // INÍCIO DA ALTERAÇÃO - Ordena pelo campo 'date'
        queryConstraints.push(orderBy("date", "desc"));
        // FIM DA ALTERAÇÃO

        const q = query(transactionsCollectionRef, ...queryConstraints);
        
        const querySnapshot = await getDocs(q);
        const transactions = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            transactions.push({ 
                id: doc.id, 
                ...data,
                // Converte o Timestamp de volta para objeto Date para facilitar o uso no frontend
                date: data.date.toDate() 
            });
        });
        
        return transactions;

    } catch (error) {
        if (error.code === 'failed-precondition') {
             console.error("Erro de consulta no Firestore: ", error.message);
             throw new Error("O Firestore precisa de um índice para esta consulta. Verifique o console de erros do navegador para o link de criação do índice.");
        }
        console.error("Erro ao buscar transações:", error);
        throw new Error("Não foi possível buscar as transações.");
    }
}

async function deleteTransaction(transactionId) {
    try {
        const transactionDocRef = doc(db, 'transactions', transactionId);
        await deleteDoc(transactionDocRef);
    } catch (error) {
        console.error("Erro ao excluir transação:", error);
        throw new Error("Não foi possível excluir a transação.");
    }
}

/**
 * Atualiza uma transação existente, incluindo o novo campo de data.
 * @param {string} transactionId - O ID da transação a ser atualizada.
 * @param {object} updatedData - Os novos dados.
 */
async function updateTransaction(transactionId, updatedData) {
    try {
        const transactionDocRef = doc(db, 'transactions', transactionId);

        // INÍCIO DA ALTERAÇÃO - Converte a string de data para Timestamp antes de salvar
        const dataToUpdate = { ...updatedData };
        if (dataToUpdate.date && typeof dataToUpdate.date === 'string') {
            dataToUpdate.date = Timestamp.fromDate(parseDateString(dataToUpdate.date));
        }
        // FIM DA ALTERAÇÃO

        await updateDoc(transactionDocRef, dataToUpdate);
    } catch (error) {
        console.error("Erro ao atualizar transação:", error);
        throw new Error("Não foi possível salvar as alterações.");
    }
}

export { addTransaction, getTransactions, deleteTransaction, updateTransaction };
