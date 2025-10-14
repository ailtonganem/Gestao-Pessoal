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
 * Se for parcelado, distribui as parcelas nas faturas futuras.
 * @param {object} transactionData - Os dados da transação.
 * @param {object|null} cardData - Dados do cartão de crédito, se aplicável.
 * @returns {Promise<void>}
 */
async function addTransaction(transactionData, cardData = null) {
    const transactionDate = parseDateString(transactionData.date);

    if (transactionData.paymentMethod === 'credit_card' && cardData) {
        const batch = writeBatch(db);

        // INÍCIO DA ALTERAÇÃO - Lógica para compras parceladas
        if (transactionData.isInstallment && transactionData.installments > 1) {
            const totalAmount = transactionData.amount;
            // Arredonda para 2 casas decimais para evitar problemas com dízimas
            const installmentAmount = parseFloat((totalAmount / transactionData.installments).toFixed(2));

            for (let i = 0; i < transactionData.installments; i++) {
                // Calcula a data da compra para a parcela atual (avança um mês a cada iteração)
                const currentInstallmentDate = new Date(transactionDate.getFullYear(), transactionDate.getMonth() + i, transactionDate.getDate());
                
                // Encontra ou cria a fatura para o mês da parcela atual
                const invoiceId = await findOrCreateInvoice(transactionData.cardId, cardData, transactionData.userId, currentInstallmentDate);
                const invoiceRef = doc(db, 'invoices', invoiceId);
                const invoiceTransactionsRef = collection(invoiceRef, 'transactions');
                
                const newTransactionInInvoice = {
                    description: `${transactionData.description} (${i + 1}/${transactionData.installments})`,
                    amount: installmentAmount,
                    category: transactionData.category,
                    createdAt: serverTimestamp()
                };
                
                const newTransactionRef = doc(invoiceTransactionsRef);
                batch.set(newTransactionRef, newTransactionInInvoice);
                batch.update(invoiceRef, { totalAmount: increment(installmentAmount) });
            }
        // FIM DA ALTERAÇÃO
        } else {
            // Lógica para compra à vista no cartão (como era antes)
            const invoiceId = await findOrCreateInvoice(transactionData.cardId, cardData, transactionData.userId, transactionDate);
            const invoiceRef = doc(db, 'invoices', invoiceId);
            const invoiceTransactionsRef = collection(invoiceRef, 'transactions');
            
            const newTransactionInInvoice = {
                description: transactionData.description,
                amount: transactionData.amount,
                category: transactionData.category,
                createdAt: serverTimestamp()
            };
            const newTransactionRef = doc(invoiceTransactionsRef);
            batch.set(newTransactionRef, newTransactionInInvoice);
            batch.update(invoiceRef, { totalAmount: increment(transactionData.amount) });
        }

        try {
            await batch.commit();
        } catch (error) {
            console.error("Erro ao salvar transação de crédito:", error);
            throw new Error("Não foi possível salvar a transação no cartão.");
        }

    } else {
        // Lógica para transações que não são de cartão de crédito (PIX, débito, etc.)
        try {
            const transactionsCollectionRef = collection(db, 'transactions');
            const dataToSave = {
                ...transactionData,
                date: Timestamp.fromDate(transactionDate),
                createdAt: serverTimestamp()
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
 * Atualiza uma transação existente, incluindo o novo campo de data.
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
