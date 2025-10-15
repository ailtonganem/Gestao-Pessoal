// Importa a instância do Firestore.
import { db } from '../firebase-config.js';
// Importa a lógica de faturas.
import { findOrCreateInvoice } from './invoices.js';
// Importa a função de autocomplete.
import { saveUniqueDescription } from './autocomplete.js';
// Importa a função para salvar subcategorias
import { addSubcategory } from './categories.js';
import { updateBalanceInBatch } from './accounts.js';

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
    Timestamp,
    getDoc 
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
 * @param {object} transactionData - Os dados da transação.
 * @param {object|null} cardData - Dados do cartão de crédito, se aplicável.
 * @returns {Promise<void>}
 */
async function addTransaction(transactionData, cardData = null) {
    const transactionDate = parseDateString(transactionData.date);

    if (transactionData.subcategory && transactionData.categoryId) {
        addSubcategory(transactionData.categoryId, transactionData.subcategory).catch(console.error);
    }

    if (transactionData.paymentMethod === 'credit_card' && cardData) {
        const batch = writeBatch(db);

        if (transactionData.isInstallment && transactionData.installments > 1) {
            const totalAmount = transactionData.amount;
            const installmentAmount = parseFloat((totalAmount / transactionData.installments).toFixed(2));

            for (let i = 0; i < transactionData.installments; i++) {
                const currentInstallmentDate = new Date(transactionDate.getFullYear(), transactionDate.getMonth() + i, transactionDate.getDate());
                
                const invoiceId = await findOrCreateInvoice(transactionData.cardId, cardData, transactionData.userId, currentInstallmentDate);
                const invoiceRef = doc(db, 'invoices', invoiceId);
                const invoiceTransactionsRef = collection(invoiceRef, 'transactions');
                
                const newTransactionInInvoice = {
                    description: `${transactionData.description} (${i + 1}/${transactionData.installments})`,
                    amount: installmentAmount,
                    category: transactionData.category,
                    subcategory: transactionData.subcategory || null,
                    purchaseDate: Timestamp.fromDate(currentInstallmentDate),
                    createdAt: serverTimestamp()
                };
                
                const newTransactionRef = doc(invoiceTransactionsRef);
                batch.set(newTransactionRef, newTransactionInInvoice);
                batch.update(invoiceRef, { totalAmount: increment(installmentAmount) });
            }
        } else {
            const invoiceId = await findOrCreateInvoice(transactionData.cardId, cardData, transactionData.userId, transactionDate);
            const invoiceRef = doc(db, 'invoices', invoiceId);
            const invoiceTransactionsRef = collection(invoiceRef, 'transactions');
            
            const newTransactionInInvoice = {
                description: transactionData.description,
                amount: transactionData.amount,
                category: transactionData.category,
                subcategory: transactionData.subcategory || null,
                purchaseDate: Timestamp.fromDate(transactionDate),
                createdAt: serverTimestamp()
            };
            const newTransactionRef = doc(invoiceTransactionsRef);
            batch.set(newTransactionRef, newTransactionInInvoice);
            batch.update(invoiceRef, { totalAmount: increment(transactionData.amount) });
        }

        try {
            await batch.commit();
            saveUniqueDescription(transactionData.userId, transactionData.description);
        } catch (error) {
            console.error("Erro ao salvar transação de crédito:", error);
            throw new Error("Não foi possível salvar a transação no cartão.");
        }

    } else {
        const batch = writeBatch(db);
        try {
            const transactionsCollectionRef = collection(db, 'transactions');
            const newTransactionRef = doc(transactionsCollectionRef);

            const dataToSave = {
                description: transactionData.description,
                amount: transactionData.amount,
                date: Timestamp.fromDate(transactionDate),
                type: transactionData.type,
                category: transactionData.category,
                subcategory: transactionData.subcategory || null,
                paymentMethod: transactionData.paymentMethod,
                userId: transactionData.userId,
                accountId: transactionData.accountId, 
                createdAt: serverTimestamp()
            };
            
            batch.set(newTransactionRef, dataToSave);
            updateBalanceInBatch(batch, transactionData.accountId, transactionData.amount, transactionData.type);
            
            await batch.commit();
            saveUniqueDescription(transactionData.userId, transactionData.description);

        } catch (error) {
            console.error("Erro ao adicionar transação:", error);
            throw new Error("Não foi possível salvar a transação.");
        }
    }
}

/**
 * Busca as transações de fluxo de caixa de um usuário com filtros.
 * @param {string} userId - O ID do usuário.
 * @param {object} filters - Objeto com os filtros (month, year, startDate, endDate, type).
 * @returns {Promise<Array>} Uma lista de objetos de transação.
 */
async function getTransactions(userId, filters = {}) {
    // INÍCIO DA ALTERAÇÃO - Extrai o novo filtro 'type'
    const { month, year, startDate, endDate, type } = filters;
    // FIM DA ALTERAÇÃO
    try {
        const transactionsCollectionRef = collection(db, 'transactions');
        
        let queryConstraints = [
            where("userId", "==", userId)
        ];

        // INÍCIO DA ALTERAÇÃO - Adiciona o filtro por tipo à consulta do Firestore
        if (type && type !== 'all') {
            queryConstraints.push(where("type", "==", type));
        }
        // FIM DA ALTERAÇÃO

        if (startDate && endDate) {
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T23:59:59');
            queryConstraints.push(where("date", ">=", Timestamp.fromDate(start)));
            queryConstraints.push(where("date", "<=", Timestamp.fromDate(end)));
        } else if (year && month && month !== 'all') {
            const startOfMonth = new Date(year, month - 1, 1);
            const endOfMonth = new Date(year, month, 0, 23, 59, 59);
            queryConstraints.push(where("date", ">=", Timestamp.fromDate(startOfMonth)));
            queryConstraints.push(where("date", "<=", Timestamp.fromDate(endOfMonth)));
        } else if (year) {
            const startOfYear = new Date(year, 0, 1);
            const endOfYear = new Date(year, 11, 31, 23, 59, 59);
            queryConstraints.push(where("date", ">=", Timestamp.fromDate(startOfYear)));
            queryConstraints.push(where("date", "<=", Timestamp.fromDate(endOfYear)));
        }
        
        // A ordenação por data permanece como padrão. A ordenação final será feita no cliente.
        queryConstraints.push(orderBy("date", "desc"));

        const q = query(transactionsCollectionRef, ...queryConstraints);
        
        const querySnapshot = await getDocs(q);
        const transactions = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            transactions.push({ 
                id: doc.id, 
                ...data,
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

/**
 * Exclui uma transação e reverte o seu impacto no saldo da conta.
 * @param {object} transaction - O objeto completo da transação a ser excluída.
 */
async function deleteTransaction(transaction) {
    if (!transaction.accountId) {
        throw new Error("Não é possível excluir transações sem conta associada.");
    }
    
    const batch = writeBatch(db);
    try {
        const transactionDocRef = doc(db, 'transactions', transaction.id);
        batch.delete(transactionDocRef);

        const reverseType = transaction.type === 'expense' ? 'revenue' : 'expense';
        updateBalanceInBatch(batch, transaction.accountId, transaction.amount, reverseType);

        await batch.commit();
    } catch (error) {
        console.error("Erro ao excluir transação:", error);
        throw new Error("Não foi possível excluir a transação.");
    }
}

/**
 * Atualiza uma transação e ajusta os saldos das contas envolvidas.
 * @param {string} transactionId - O ID da transação a ser atualizada.
 * @param {object} updatedData - Os novos dados, incluindo o novo accountId.
 */
async function updateTransaction(transactionId, updatedData) {
    const batch = writeBatch(db);
    const transactionDocRef = doc(db, 'transactions', transactionId);

    try {
        const originalTxSnap = await getDoc(transactionDocRef);
        if (!originalTxSnap.exists()) {
            throw new Error("Transação não encontrada para atualização.");
        }
        const originalTxData = originalTxSnap.data();

        const reverseType = originalTxData.type === 'expense' ? 'revenue' : 'expense';
        updateBalanceInBatch(batch, originalTxData.accountId, originalTxData.amount, reverseType);

        updateBalanceInBatch(batch, updatedData.accountId, updatedData.amount, updatedData.type);

        const dataToUpdate = { ...updatedData };
        if (dataToUpdate.date && typeof dataToUpdate.date === 'string') {
            dataToUpdate.date = Timestamp.fromDate(parseDateString(dataToUpdate.date));
        }
        batch.update(transactionDocRef, dataToUpdate);
        
        await batch.commit();

    } catch (error) {
        console.error("Erro ao atualizar transação:", error);
        throw new Error("Não foi possível salvar as alterações.");
    }
}

export { addTransaction, getTransactions, deleteTransaction, updateTransaction };
