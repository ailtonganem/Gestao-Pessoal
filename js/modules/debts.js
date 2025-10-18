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
// --- INÍCIO DA ALTERAÇÃO ---
import { addRecurringTransaction } from './recurring.js';
// --- FIM DA ALTERAÇÃO ---

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
            
            updateBalanceInBatch(batch, accountId, installmentAmount, 'expense');
        }

        const debtRef = doc(db, COLLECTIONS.DEBTS, debt.id);
        const newAmountPaid = (debt.amountPaid || 0) + installmentAmount;
        const newInstallmentsPaid = (debt.installmentsPaid || 0) + 1;
        
        const debtUpdateData = {
            amountPaid: increment(installmentAmount),
            installmentsPaid: increment(1)
        };

        if (newInstallmentsPaid >= debt.totalInstallments || newAmountPaid >= debt.totalAmount) {
            debtUpdateData.status = 'paid';
        }

        batch.update(debtRef, debtUpdateData);
        await batch.commit();

    } catch (error) {
        console.error("Erro ao pagar parcela da dívida:", error);
        throw new Error("Ocorreu um erro ao registrar o pagamento da parcela.");
    }
}

/**
 * Calcula a evolução do saldo devedor total nos últimos 12 meses.
 * @param {string} userId - O ID do usuário.
 * @param {Array<object>} allUserTransactions - Todas as transações do usuário para evitar nova busca.
 * @returns {Promise<object>} Objeto com labels e data para o gráfico.
 */
async function getDebtEvolutionData(userId, allUserTransactions) {
    try {
        const allDebts = await getDebts(userId);
        const debtPayments = allUserTransactions.filter(t => t.description.startsWith('Pagamento Parcela -'));

        const labels = [];
        const data = [];
        const today = new Date();

        for (let i = 11; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthLabel = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
            labels.push(monthLabel);
            
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

            const totalDebtPrincipal = allDebts
                .filter(d => d.contractDate <= endOfMonth)
                .reduce((sum, d) => sum + d.totalAmount, 0);

            const totalPaidUpToMonth = debtPayments
                .filter(p => p.date <= endOfMonth)
                .reduce((sum, p) => sum + p.amount, 0);

            const balance = totalDebtPrincipal - totalPaidUpToMonth;
            data.push(balance > 0 ? balance : 0);
        }

        return { labels, data };
    } catch (error) {
        console.error("Erro ao calcular evolução da dívida:", error);
        throw new Error("Não foi possível gerar os dados para o gráfico de evolução.");
    }
}

/**
 * Agrega o saldo devedor por tipo de dívida para o gráfico de composição.
 * @param {Array<object>} userDebts - A lista de dívidas do usuário.
 * @returns {object} Objeto com labels e data para o gráfico.
 */
function getDebtCompositionData(userDebts) {
    const composition = userDebts
        .filter(d => d.status === 'active')
        .reduce((acc, debt) => {
            const balance = debt.totalAmount - (debt.amountPaid || 0);
            const type = debt.type || 'other'; 

            if (!acc[type]) {
                acc[type] = 0;
            }
            acc[type] += balance;
            return acc;
        }, {});

    const typeTranslations = {
        financing: 'Financiamento',
        personal_loan: 'Empréstimo Pessoal',
        payroll_loan: 'Empréstimo Consignado',
        credit_card_installment: 'Parcelamento de Fatura',
        other: 'Outro'
    };

    const labels = Object.keys(composition).map(key => typeTranslations[key] || 'Desconhecido');
    const data = Object.values(composition);

    return { labels, data };
}

// --- INÍCIO DA ALTERAÇÃO ---
/**
 * Cria uma transação recorrente associada a uma dívida, se aplicável.
 * @param {object} debtData - Os dados da dívida que acabou de ser criada.
 * @returns {Promise<void>}
 */
async function createRecurringTransactionForDebt(debtData) {
    // Apenas cria recorrência para pagamentos automáticos ou semi-automáticos
    if (debtData.paymentMethod === 'account_debit' || debtData.paymentMethod === 'payroll') {
        try {
            const recurringData = {
                description: `Recorrência - Pagamento Parcela - ${debtData.description}`,
                amount: debtData.installmentAmount,
                dayOfMonth: debtData.dueDay,
                type: 'expense',
                category: debtData.category,
                paymentMethod: 'account_debit', // Mesmo para desconto em folha, lançamos como débito para fins de fluxo de caixa
                accountId: null, // Será null pois o usuário precisa selecionar a conta de onde o dinheiro "sai" no app
                cardId: null,
                userId: debtData.userId,
            };
            
            // Pergunta ao usuário se deseja criar a recorrência
            if (confirm("Deseja criar uma transação recorrente automática para o pagamento desta dívida?")) {
                await addRecurringTransaction(recurringData);
                return "Recorrência para a dívida criada com sucesso!";
            }
        } catch (error) {
            console.error("Erro ao criar recorrência para a dívida:", error);
            // Não lança um erro fatal, pois a dívida já foi criada. Apenas informa o usuário.
            return "A dívida foi salva, mas ocorreu um erro ao tentar criar a recorrência automática.";
        }
    }
    return null; // Nenhuma ação necessária
}

export { addDebt, getDebts, payDebtInstallment, getDebtEvolutionData, getDebtCompositionData, createRecurringTransactionForDebt };
// --- FIM DA ALTERAÇÃO ---
