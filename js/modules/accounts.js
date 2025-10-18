// js/modules/accounts.js

// Importa a instância do Firestore e funções necessárias.
import { db } from '../firebase-config.js';
import { COLLECTIONS } from '../config/constants.js';
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    doc,
    deleteDoc,
    updateDoc,
    orderBy,
    writeBatch,
    Timestamp,
    increment
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Adiciona uma nova conta para o usuário.
 * @param {object} accountData - Dados da nova conta.
 * @param {string} accountData.name - Nome da conta (Ex: "Carteira", "Conta Bradesco").
 * @param {number} accountData.initialBalance - Saldo inicial da conta.
 * @param {string} accountData.type - Tipo da conta (Ex: "checking", "savings", "wallet").
 * @param {string} accountData.userId - ID do usuário.
 * @returns {Promise<DocumentReference>}
 */
async function addAccount(accountData) {
    try {
        const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
        const dataToSave = {
            ...accountData,
            currentBalance: accountData.initialBalance, // Saldo atual começa com o saldo inicial
            createdAt: Timestamp.now()
        };
        return await addDoc(accountsRef, dataToSave);
    } catch (error) {
        console.error("Erro ao adicionar conta:", error);
        throw new Error("Não foi possível salvar a nova conta.");
    }
}

/**
 * Busca todas as contas de um usuário específico, excluindo as contas de investimento.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<Array<object>>} Uma lista de objetos de conta.
 */
async function getAccounts(userId) {
    try {
        const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
        // --- INÍCIO DA ALTERAÇÃO ---
        const q = query(
            accountsRef,
            where("userId", "==", userId),
            where("type", "!=", "investment"), // Filtra para não incluir contas do tipo 'investment'
            orderBy("name")
        );
        // --- FIM DA ALTERAÇÃO ---
        const querySnapshot = await getDocs(q);
        const accounts = [];
        querySnapshot.forEach((doc) => {
            accounts.push({
                id: doc.id,
                ...doc.data()
            });
        });
        return accounts;
    } catch (error) {
        console.error("Erro ao buscar contas:", error);
        throw new Error("Não foi possível carregar as contas.");
    }
}

/**
 * Atualiza os dados de uma conta.
 * @param {string} accountId - O ID do documento da conta.
 * @param {object} updatedData - Os novos dados para a conta.
 * @returns {Promise<void>}
 */
async function updateAccount(accountId, updatedData) {
    try {
        const accountDocRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
        await updateDoc(accountDocRef, updatedData);
    } catch (error) {
        console.error("Erro ao atualizar conta:", error);
        throw new Error("Não foi possível salvar as alterações da conta.");
    }
}

/**
 * Exclui uma conta.
 * ATENÇÃO: Esta função apenas remove a conta. A lógica para lidar com
 * transações associadas a esta conta precisa ser definida.
 * @param {string} accountId - O ID do documento da conta.
 * @returns {Promise<void>}
 */
async function deleteAccount(accountId) {
    try {
        // Futuramente, podemos adicionar uma verificação se a conta possui transações
        // e impedir a exclusão ou pedir confirmação extra.
        const accountDocRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
        await deleteDoc(accountDocRef);
    } catch (error) {
        console.error("Erro ao excluir conta:", error);
        throw new Error("Não foi possível excluir a conta.");
    }
}

/**
 * Atualiza o saldo de uma conta com base em uma transação.
 * @param {WriteBatch} batch - O batch do Firestore para executar a operação atomicamente.
 * @param {string} accountId - O ID da conta a ser atualizada.
 * @param {number} amount - O valor da transação.
 * @param {string} transactionType - 'revenue' ou 'expense'.
 */
function updateBalanceInBatch(batch, accountId, amount, transactionType) {
    const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
    const amountToUpdate = transactionType === 'revenue' ? amount : -amount;
    batch.update(accountRef, { currentBalance: increment(amountToUpdate) });
}


export { addAccount, getAccounts, updateAccount, deleteAccount, updateBalanceInBatch };
