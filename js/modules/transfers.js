// js/modules/transfers.js

// Importa a instância do Firestore e funções necessárias.
import { db } from '../firebase-config.js';
// INÍCIO DA ALTERAÇÃO - Importa as constantes de coleções
import { COLLECTIONS } from '../config/constants.js';
// FIM DA ALTERAÇÃO
import {
    collection,
    doc,
    writeBatch,
    Timestamp,
    serverTimestamp,
    getDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Importa a função auxiliar para atualizar saldos de contas
import { updateBalanceInBatch } from './accounts.js';

/**
 * Registra uma transferência entre duas contas.
 * Cria um documento de transação do tipo 'transfer' e atualiza os saldos
 * da conta de origem e de destino de forma atômica.
 * @param {object} transferData - Dados da transferência.
 * @param {string} transferData.userId - O ID do usuário.
 * @param {string} transferData.fromAccountId - O ID da conta de origem.
 * @param {string} transferData.toAccountId - O ID da conta de destino.
 * @param {number} transferData.amount - O valor a ser transferido.
 * @param {string} transferData.date - A data da transferência.
 * @param {string} [transferData.description] - Uma descrição opcional.
 * @returns {Promise<void>}
 */
async function addTransfer(transferData) {
    if (transferData.fromAccountId === transferData.toAccountId) {
        throw new Error("A conta de origem e destino não podem ser a mesma.");
    }

    const batch = writeBatch(db);
    try {
        // INÍCIO DA ALTERAÇÃO
        const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
        // FIM DA ALTERAÇÃO
        const newTransactionRef = doc(transactionsRef);

        const transferDate = new Date(transferData.date + 'T00:00:00');

        // 1. Prepara o documento da transação de transferência
        const dataToSave = {
            userId: transferData.userId,
            type: 'transfer',
            fromAccountId: transferData.fromAccountId,
            toAccountId: transferData.toAccountId,
            amount: transferData.amount,
            date: Timestamp.fromDate(transferDate),
            description: transferData.description || "Transferência entre contas",
            createdAt: serverTimestamp()
        };
        batch.set(newTransactionRef, dataToSave);

        // 2. Debita o valor da conta de origem (trata como despesa)
        updateBalanceInBatch(batch, transferData.fromAccountId, transferData.amount, 'expense');

        // 3. Credita o valor na conta de destino (trata como receita)
        updateBalanceInBatch(batch, transferData.toAccountId, transferData.amount, 'revenue');

        // 4. Executa todas as operações atomicamente
        await batch.commit();

    } catch (error) {
        console.error("Erro ao registrar transferência:", error);
        throw new Error("Não foi possível registrar a transferência.");
    }
}

/**
 * Exclui uma transferência e reverte o impacto nos saldos das contas envolvidas.
 * @param {object} transfer - O objeto completo da transferência a ser excluída.
 * @returns {Promise<void>}
 */
async function deleteTransfer(transfer) {
    const batch = writeBatch(db);
    try {
        // INÍCIO DA ALTERAÇÃO
        const transferDocRef = doc(db, COLLECTIONS.TRANSACTIONS, transfer.id);
        // FIM DA ALTERAÇÃO
        
        // 1. Reverte o débito na conta de origem (soma o valor de volta)
        updateBalanceInBatch(batch, transfer.fromAccountId, transfer.amount, 'revenue');
        
        // 2. Reverte o crédito na conta de destino (subtrai o valor)
        updateBalanceInBatch(batch, transfer.toAccountId, transfer.amount, 'expense');

        // 3. Exclui o documento da transferência
        batch.delete(transferDocRef);

        await batch.commit();
    } catch (error) {
        console.error("Erro ao excluir transferência:", error);
        throw new Error("Não foi possível excluir a transferência.");
    }
}

/**
 * Atualiza uma transferência, revertendo a operação original e aplicando a nova.
 * @param {string} transferId - O ID da transferência a ser atualizada.
 * @param {object} updatedData - Os novos dados da transferência.
 * @returns {Promise<void>}
 */
async function updateTransfer(transferId, updatedData) {
    if (updatedData.fromAccountId === updatedData.toAccountId) {
        throw new Error("A conta de origem e destino não podem ser a mesma.");
    }

    const batch = writeBatch(db);
    // INÍCIO DA ALTERAÇÃO
    const transferDocRef = doc(db, COLLECTIONS.TRANSACTIONS, transferId);
    // FIM DA ALTERAÇÃO
    
    try {
        // Pega os dados originais da transferência para poder revertê-los
        const originalTransferSnap = await getDoc(transferDocRef);
        if (!originalTransferSnap.exists()) {
            throw new Error("Transferência original não encontrada.");
        }
        const originalData = originalTransferSnap.data();

        // 1. Reverte a transferência original
        // Soma na origem original
        updateBalanceInBatch(batch, originalData.fromAccountId, originalData.amount, 'revenue');
        // Subtrai no destino original
        updateBalanceInBatch(batch, originalData.toAccountId, originalData.amount, 'expense');

        // 2. Aplica a nova transferência
        // Subtrai da nova origem
        updateBalanceInBatch(batch, updatedData.fromAccountId, updatedData.amount, 'expense');
        // Soma no novo destino
        updateBalanceInBatch(batch, updatedData.toAccountId, updatedData.amount, 'revenue');
        
        // 3. Atualiza o documento da transferência com os novos dados
        const dataToSave = {
            ...updatedData,
            date: Timestamp.fromDate(new Date(updatedData.date + 'T00:00:00'))
        };
        batch.update(transferDocRef, dataToSave);

        await batch.commit();
    } catch (error) {
        console.error("Erro ao atualizar transferência:", error);
        throw new Error("Não foi possível salvar as alterações na transferência.");
    }
}

export { addTransfer, deleteTransfer, updateTransfer };
