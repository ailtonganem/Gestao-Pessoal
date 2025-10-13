// Importa a instância do Firestore que configuramos.
import { db } from '../firebase-config.js';

// Importa as funções do Firestore necessárias para manipular os dados.
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
    // ADIÇÃO: Função para atualizar um documento
    updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Adiciona um novo documento de transação na coleção 'transactions'.
 * @param {object} transactionData - Os dados da transação.
 * @returns {Promise<DocumentReference>} A referência do documento criado.
 */
async function addTransaction(transactionData) {
    try {
        const transactionsCollectionRef = collection(db, 'transactions');
        const docRef = await addDoc(transactionsCollectionRef, {
            ...transactionData,
            createdAt: serverTimestamp() // Adiciona data/hora do servidor
        });
        console.log("Transação adicionada com o ID: ", docRef.id);
        return docRef;
    } catch (error) {
        console.error("Erro ao adicionar transação:", error);
        throw new Error("Não foi possível salvar a transação.");
    }
}

/**
 * Busca todas as transações de um usuário específico, ordenadas pela data de criação.
 * @param {string} userId - O ID do usuário cujas transações devem ser buscadas.
 * @returns {Promise<Array>} Uma lista de objetos de transação.
 */
async function getTransactions(userId) {
    try {
        const transactionsCollectionRef = collection(db, 'transactions');
        const q = query(
            transactionsCollectionRef,
            where("userId", "==", userId),
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

/**
 * Exclui uma transação do Firestore com base no seu ID.
 * @param {string} transactionId - O ID do documento da transação a ser excluída.
 * @returns {Promise<void>}
 */
async function deleteTransaction(transactionId) {
    try {
        const transactionDocRef = doc(db, 'transactions', transactionId);
        await deleteDoc(transactionDocRef);
        console.log(`Transação com ID ${transactionId} foi excluída.`);
    } catch (error) {
        console.error("Erro ao excluir transação:", error);
        throw new Error("Não foi possível excluir a transação.");
    }
}

// INÍCIO DA ALTERAÇÃO
/**
 * Atualiza uma transação existente no Firestore.
 * @param {string} transactionId - O ID do documento a ser atualizado.
 * @param {object} updatedData - Um objeto com os campos a serem atualizados.
 * @returns {Promise<void>}
 */
async function updateTransaction(transactionId, updatedData) {
    try {
        // Cria uma referência direta ao documento que queremos atualizar.
        const transactionDocRef = doc(db, 'transactions', transactionId);

        // Atualiza o documento com os novos dados.
        // O updateDoc só altera os campos especificados, mantendo os outros.
        await updateDoc(transactionDocRef, updatedData);

        console.log(`Transação com ID ${transactionId} foi atualizada.`);
    } catch (error) {
        console.error("Erro ao atualizar transação:", error);
        throw new Error("Não foi possível salvar as alterações.");
    }
}
// FIM DA ALTERAÇÃO


// Exporta as funções para serem usadas em outros lugares da aplicação.
// ATUALIZAÇÃO: Exporta a nova função.
export { addTransaction, getTransactions, deleteTransaction, updateTransaction };
