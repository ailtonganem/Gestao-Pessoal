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
            createdAt: Timestamp.now(),
            status: 'active' 
        };
        return await addDoc(accountsRef, dataToSave);
    } catch (error) {
        console.error("Erro ao adicionar conta:", error);
        throw new Error("Não foi possível salvar a nova conta.");
    }
}

/**
 * Busca todas as contas ativas de um usuário específico, excluindo as contas de investimento.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<Array<object>>} Uma lista de objetos de conta.
 */
async function getAccounts(userId) {
    try {
        const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
        // --- INÍCIO DA ALTERAÇÃO ---
        // A consulta agora ordena primeiro por 'status' para atender à exigência do Firestore
        // ao usar o filtro 'not-in', e depois por 'name' para manter a ordem alfabética.
        const q = query(
            accountsRef,
            where("userId", "==", userId),
            where("status", "not-in", ["archived"]),
            orderBy("status"),
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
 * Arquiva uma conta mudando seu status para 'archived'.
 * @param {string} accountId - O ID do documento da conta.
 * @returns {Promise<void>}
 */
async function archiveAccount(accountId) {
    try {
        const accountDocRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
        await updateDoc(accountDocRef, { status: 'archived' });
    } catch (error) {
        console.error("Erro ao arquivar conta:", error);
        throw new Error("Não foi possível arquivar a conta.");
    }
}

/**
 * Reativa uma conta mudando seu status para 'active'.
 * @param {string} accountId - O ID do documento da conta.
 * @returns {Promise<void>}
 */
async function unarchiveAccount(accountId) {
    try {
        const accountDocRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
        await updateDoc(accountDocRef, { status: 'active' });
    } catch (error) {
        console.error("Erro ao reativar conta:", error);
        throw new Error("Não foi possível reativar a conta.");
    }
}


/**
 * Exclui uma conta permanentemente.
 * @param {string} accountId - O ID do documento da conta.
 * @returns {Promise<void>}
 */
async function deleteAccount(accountId) {
    try {
        const accountDocRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
        await deleteDoc(accountDocRef);
    } catch (error) {
        console.error("Erro ao excluir conta permanentemente:", error);
        throw new Error("Não foi possível excluir a conta permanentemente.");
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

/**
 * Busca todas as contas arquivadas de um usuário.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<Array<object>>} Uma lista de objetos de conta arquivada.
 */
async function getArchivedAccounts(userId) {
    try {
        const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
        const q = query(
            accountsRef,
            where("userId", "==", userId),
            where("status", "==", "archived"),
            orderBy("name")
        );
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
        console.error("Erro ao buscar contas arquivadas:", error);
        throw new Error("Não foi possível carregar as contas arquivadas.");
    }
}


export { addAccount, getAccounts, updateAccount, deleteAccount, archiveAccount, unarchiveAccount, updateBalanceInBatch, getArchivedAccounts };
