// js/modules/transfers.js

// Importa a instância do Firestore e funções necessárias.
import { db } from '../firebase-config.js';
import {
    collection,
    doc,
    writeBatch,
    Timestamp,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Importa a função auxiliar para atualizar saldos de contas
import { updateBalanceInBatch } from './accounts.js';

const TRANSACTIONS_COLLECTION = 'transactions';

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
        const transactionsRef = collection(db, TRANSACTIONS_COLLECTION);
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

export { addTransfer };
