// js/modules/debts.js

/**
 * Módulo para gerenciar a lógica de negócio das dívidas,
 * incluindo criação, leitura e pagamento de parcelas.
 */

import { db } from '../firebase-config.js';
import { COLLECTIONS } from '../config/constants.js';
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    doc,
    writeBatch,
    Timestamp,
    orderBy,
    increment
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { updateBalanceInBatch } from './accounts.js';

/**
 * Adiciona uma nova dívida ao Firestore.
 * @param {object} debtData - Dados da nova dívida.
 * @returns {Promise<void>}
 */
async function addDebt(debtData) {
    try {
        const debtsRef = collection(db, COLLECTIONS.DEBTS);
        const dataToSave = {
            ...debtData,
            startDate: Timestamp.fromDate(new Date(debtData.startDate + 'T00:00:00')),
            contractDate: Timestamp.fromDate(new Date(debtData.contractDate + 'T00:00:00')),
            interestRate: debtData.interestRate || 0,
            amountPaid: 0,
            installmentsPaid: 0,
            status: 'active', // 'active' or 'paid'
            createdAt: Timestamp.now()
        };
        await addDoc(debtsRef, dataToSave);
    } catch (error) {
        console.error("Erro ao adicionar dívida:", error);
        throw new Error("Não foi possível salvar a nova dívida.");
    }
}

/**
 * Busca todas as dívidas de um usuário.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<Array<object>>} Uma lista de objetos de dívida.
 */
async function getDebts(userId) {
    try {
        const debtsRef = collection(db, COLLECTIONS.DEBTS);
        const q = query(
            debtsRef,
            where("userId", "==", userId),
            orderBy("status"), // Mostra ativas primeiro
            orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);
        const debts = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            debts.push({
                id: doc.id,
                ...data,
                startDate: data.startDate.toDate(),
                contractDate: data.contractDate ? data.contractDate.toDate() : null
            });
        });
        return debts;
    } catch (error) {
        console.error("Erro ao buscar dívidas:", error);
        throw new Error("Não foi possível carregar suas dívidas.");
    }
}

/**
 * Registra o pagamento de uma parcela de uma dívida.
 * @param {object} debt - O objeto completo da dívida.
 * @param {object} paymentDetails - Detalhes do pagamento.
 * @param {string} paymentDetails.accountId - ID da conta usada para o pagamento.
 * @param {string} paymentDetails.paymentDate - Data do pagamento.
 * @returns {Promise<void>}
 */
async function payDebtInstallment(debt, paymentDetails) {
    const batch = writeBatch(db);
    try {
        const { accountId, paymentDate } = paymentDetails;
        const installmentAmount = debt.installmentAmount;

        // 1. Cria a transação de despesa correspondente ao pagamento, apenas se o método for 'Débito em Conta'.
        if (debt.paymentMethod === 'account_debit') {
            if (!accountId) {
                throw new Error("Uma conta de pagamento deve ser selecionada para este tipo de dívida.");
            }
            const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
            const newTransactionRef = doc(transactionsRef);
            const parsedPaymentDate = new Date(paymentDate + 'T00:00:00');

            const paymentTransactionData = {
                description: `Pagamento Parcela - ${debt.description}`,
                amount: installmentAmount,
                type: 'expense',
                category: debt.category,
                paymentMethod: 'debit',
                userId: debt.userId,
                accountId: accountId,
                date: Timestamp.fromDate(parsedPaymentDate),
                createdAt: Timestamp.now()
            };
            batch.set(newTransactionRef, paymentTransactionData);
            
            // 2. Debita o valor do saldo da conta selecionada
            updateBalanceInBatch(batch, accountId, installmentAmount, 'expense');
        }

        // 3. Atualiza os valores pagos na dívida
        const debtRef = doc(db, COLLECTIONS.DEBTS, debt.id);
        const newAmountPaid = (debt.amountPaid || 0) + installmentAmount;
        const newInstallmentsPaid = (debt.installmentsPaid || 0) + 1;
        
        const debtUpdateData = {
            amountPaid: increment(installmentAmount),
            installmentsPaid: increment(1)
        };

        // 4. Verifica se a dívida foi quitada e atualiza o status
        if (newInstallmentsPaid >= debt.totalInstallments || newAmountPaid >= debt.totalAmount) {
            debtUpdateData.status = 'paid';
        }

        batch.update(debtRef, debtUpdateData);

        // 5. Executa todas as operações atomicamente
        await batch.commit();

    } catch (error) {
        console.error("Erro ao pagar parcela da dívida:", error);
        throw new Error("Ocorreu um erro ao registrar o pagamento da parcela.");
    }
}

export { addDebt, getDebts, payDebtInstallment };
