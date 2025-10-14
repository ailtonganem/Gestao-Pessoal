// Importa a instância do Firestore.
import { db } from '../firebase-config.js';
// Importa a lógica de faturas.
import { findOrCreateInvoice } from './invoices.js';
// Importa a função de autocomplete.
import { saveUniqueDescription } from './autocomplete.js';
// INÍCIO DA ALTERAÇÃO - Importa a função para salvar subcategorias
import { addSubcategory } from './categories.js';
// FIM DA ALTERAÇÃO

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
 * @param {object} transactionData - Os dados da transação.
 * @param {object|null} cardData - Dados do cartão de crédito, se aplicável.
 * @returns {Promise<void>}
 */
async function addTransaction(transactionData, cardData = null) {
    const transactionDate = parseDateString(transactionData.date);

    // INÍCIO DA ALTERAÇÃO - Lógica para salvar a subcategoria se ela for nova
    if (transactionData.subcategory && transactionData.categoryId) {
        // Salva a nova subcategoria em segundo plano, não bloqueia o fluxo principal
        addSubcategory(transactionData.categoryId, transactionData.subcategory).catch(console.error);
    }
    // FIM DA ALTERAÇÃO

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
                    subcategory: transactionData.subcategory || null, // Adiciona subcategoria
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
                subcategory: transactionData.subcategory || null, // Adiciona subcategoria
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
        try {
            const transactionsCollectionRef = collection(db, 'transactions');
            const dataToSave = {
                description: transactionData.description,
                amount: transactionData.amount,
                date: Timestamp.fromDate(transactionDate),
                type: transactionData.type,
                category: transactionData.category,
                subcategory: transactionData.subcategory || null, // Adiciona subcategoria
                paymentMethod: transactionData.paymentMethod,
                userId: transactionData.userId,
                createdAt: serverTimestamp()
            };
            await addDoc(transactionsCollectionRef, dataToSave);
            saveUniqueDescription(transactionData.userId, transactionData.description);
        } catch (error) {
            console.error("Erro ao adicionar transação:", error);
            throw new Error("Não foi possível salvar a transação.");
        }
    }
}

/**
 * Busca as transações de fluxo de caixa de um usuário.
 * @param {string} userId - O ID do usuário.
 * @param {object} filters - Objeto com os filtros.
 * @returns {Promise<Array>} Uma lista de objetos de transação.
 */
async function getTransactions(userId, filters = {}) {
    const { month, year } = filters;
    try {
        const transactionsCollectionRef = collection(db, 'transactions');
        
        let queryConstraints = [
            where("userId", "==", userId),
            where("paymentMethod", "in", ["pix", "debit", "cash"])
        ];

        if (year && month && month !== 'all') {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            
            queryConstraints.push(where("date", ">=", Timestamp.fromDate(startDate)));
            queryConstraints.push(where("date", "<=", Timestamp.fromDate(endDate)));
        } else if (year) {
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);

            queryConstraints.push(where("date", ">=", Timestamp.fromDate(startDate)));
            queryConstraints.push(where("date", "<=", Timestamp.fromDate(endDate)));
        }
        
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
 * Atualiza uma transação existente.
 * @param {string} transactionId - O ID da transação a ser atualizada.
 * @param {object} updatedData - Os novos dados.
 */
async function updateTransaction(transactionId, updatedData) {
    try {
        const transactionDocRef = doc(db, 'transactions', transactionId);

        const dataToUpdate = { ...updatedData };
        if (dataToUpdate.date && typeof dataToUpdate.date === 'string') {
            dataToUpdate.date = Timestamp.fromDate(parseDateString(dataToUpdate.date));
        }

        await updateDoc(transactionDocRef, dataToUpdate);
    } catch (error) {
        console.error("Erro ao atualizar transação:", error);
        throw new Error("Não foi possível salvar as alterações.");
    }
}

export { addTransaction, getTransactions, deleteTransaction, updateTransaction };
