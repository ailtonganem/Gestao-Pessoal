// Importa a instância do Firestore.
import { db } from '../firebase-config.js';
// ADIÇÃO: Importa a lógica de faturas.
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
    // ADIÇÃO: Funções para transações e atualizações atômicas.
    writeBatch,
    increment
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Adiciona um novo documento de transação.
 * Se for cartão de crédito, associa a uma fatura.
 * @param {object} transactionData - Os dados da transação.
 * @param {object|null} cardData - Dados do cartão de crédito, se aplicável.
 * @returns {Promise<void>}
 */
async function addTransaction(transactionData, cardData = null) {
    // Se for uma transação de cartão de crédito
    if (transactionData.paymentMethod === 'credit_card' && cardData) {
        try {
            const transactionDate = new Date(); // Usa a data atual para a transação
            const invoiceId = await findOrCreateInvoice(transactionData.cardId, cardData, transactionData.userId, transactionDate);

            // Cria uma referência para a subcoleção de transações dentro da fatura
            const invoiceRef = doc(db, 'invoices', invoiceId);
            const invoiceTransactionsRef = collection(invoiceRef, 'transactions');
            
            // Prepara a atualização da fatura e a adição da nova transação
            const batch = writeBatch(db);

            // 1. Adiciona a nova transação na subcoleção da fatura
            const newTransactionInInvoice = {
                description: transactionData.description,
                amount: transactionData.amount,
                category: transactionData.category,
                createdAt: serverTimestamp()
            };
            // Precisamos de uma nova referência de documento para a transação que será adicionada
            const newTransactionRef = doc(collection(invoiceTransactionsRef));
            batch.set(newTransactionRef, newTransactionInInvoice);
            
            // 2. Atualiza o valor total da fatura de forma atômica
            batch.update(invoiceRef, {
                totalAmount: increment(transactionData.amount)
            });

            // Executa as duas operações em conjunto
            await batch.commit();
            console.log(`Transação de crédito adicionada à fatura ${invoiceId}`);

        } catch (error) {
            console.error("Erro ao adicionar transação de crédito:", error);
            throw new Error("Não foi possível salvar a transação no cartão.");
        }
    } else {
        // Lógica original para transações que não são de cartão de crédito
        try {
            const transactionsCollectionRef = collection(db, 'transactions');
            await addDoc(transactionsCollectionRef, {
                ...transactionData,
                createdAt: serverTimestamp()
            });
            console.log("Transação adicionada com sucesso.");
        } catch (error) {
            console.error("Erro ao adicionar transação:", error);
            throw new Error("Não foi possível salvar a transação.");
        }
    }
}

/**
 * Busca todas as transações de um usuário (exceto as de cartão de crédito, que estão em faturas).
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<Array>} Uma lista de objetos de transação.
 */
async function getTransactions(userId) {
    try {
        const transactionsCollectionRef = collection(db, 'transactions');
        const q = query(
            transactionsCollectionRef,
            where("userId", "==", userId),
            // ADIÇÃO: Filtra para não incluir as de cartão de crédito na lista principal.
            where("paymentMethod", "!=", "credit_card"),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const transactions = [];
        querySnapshot.forEach((doc) => {
            transactions.push({
                id: doc.id,
                ...doc.data()
            });
        });
        return transactions;
    } catch (error) {
        console.error("Erro ao buscar transações:", error);
        throw new Error("Não foi possível buscar as transações.");
    }
}

// As funções delete e update permanecem as mesmas por enquanto,
// pois a edição/exclusão de transações de cartão será uma lógica mais complexa
// a ser implementada no futuro.
async function deleteTransaction(transactionId) { /* ...código inalterado... */ }
async function updateTransaction(transactionId, updatedData) { /* ...código inalterado... */ }

export { addTransaction, getTransactions, deleteTransaction, updateTransaction };
