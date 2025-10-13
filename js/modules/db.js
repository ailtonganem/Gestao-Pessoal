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
    // ADIÇÃO: Funções para deletar um documento
    doc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Adiciona um novo documento de transação na coleção 'transactions'.
 * @param {object} transactionData - Os dados da transação.
 * @param {string} transactionData.description - Descrição da transação.
 * @param {number} transactionData.amount - O valor da transação.
 * @param {string} transactionData.type - O tipo ('revenue' para receita, 'expense' para despesa).
 * @param {string} transactionData.userId - O ID do usuário que criou a transação.
 * @returns {Promise<DocumentReference>} A referência do documento criado.
 * @throws {Error} Lança um erro se a escrita no banco de dados falhar.
 */
async function addTransaction(transactionData) {
    try {
        // Cria uma referência para a nossa coleção 'transactions'.
        // Se a coleção não existir, o Firestore a criará automaticamente.
        const transactionsCollectionRef = collection(db, 'transactions');

        // Adiciona um novo documento à coleção com os dados fornecidos.
        // Incluímos um timestamp do servidor para sabermos quando foi criada.
        const docRef = await addDoc(transactionsCollectionRef, {
            description: transactionData.description,
            amount: transactionData.amount,
            type: transactionData.type,
            userId: transactionData.userId,
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

        // Cria uma consulta para buscar documentos onde o campo 'userId'
        // seja igual ao ID do usuário logado.
        const q = query(
            transactionsCollectionRef, // Corrigido de transactionsCollection_ref para transactionsCollectionRef
            where("userId", "==", userId),
            orderBy("createdAt", "desc") // Ordena das mais novas para as mais antigas
        );

        const querySnapshot = await getDocs(q);
        const transactions = [];

        // Itera sobre o resultado da consulta e formata os dados.
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

// INÍCIO DA ALTERAÇÃO
/**
 * Exclui uma transação do Firestore com base no seu ID.
 * @param {string} transactionId - O ID do documento da transação a ser excluída.
 * @returns {Promise<void>}
 * @throws {Error} Lança um erro se a exclusão falhar.
 */
async function deleteTransaction(transactionId) {
    try {
        // Cria uma referência direta ao documento que queremos excluir.
        const transactionDocRef = doc(db, 'transactions', transactionId);
        await deleteDoc(transactionDocRef);
        console.log(`Transação com ID ${transactionId} foi excluída.`);
    } catch (error) {
        console.error("Erro ao excluir transação:", error);
        throw new Error("Não foi possível excluir a transação.");
    }
}
// FIM DA ALTERAÇÃO

// Exporta as funções para serem usadas em outros lugares da aplicação.
// ATUALIZAÇÃO: Exporta a nova função.
export { addTransaction, getTransactions, deleteTransaction };
