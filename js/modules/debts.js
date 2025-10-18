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
    increment,
    // --- INÍCIO DA ALTERAÇÃO ---
    runTransaction
    // --- FIM DA ALTERAÇÃO ---
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { updateBalanceInBatch } from './accounts.js';
import { addRecurringTransaction } from './recurring.js';

/**
 * Adiciona uma nova dívida ao Firestore.
 * @param {object} debtData - Dados da nova dívida.
 * @returns {Promise<void>}
 */
async function addDebt(debtData) {
    try {
        const debtsRef = collection(db, COLLECTIONS.DEBTS);
        
        // --- INÍCIO DA ALTERAÇÃO: Lógica para diferentes modelos de dívida ---
        let dataToSave;

        if (debtData.type === 'personal_loan') {
            // Modelo de Juros Rotativo (baseado na planilha)
            dataToSave = {
                description: debtData.description,
                creditor: debtData.creditor,
                type: debtData.type,
                contractDate: Timestamp.fromDate(new Date(debtData.contractDate + 'T00:00:00')),
                initialAmount: debtData.totalAmount, // Valor Original
                currentBalance: debtData.totalAmount, // Saldo devedor inicial
                interestRate: debtData.interestRate || 0, // Taxa de contrato (se houver)
                paymentMethod: debtData.paymentMethod,
                category: debtData.category,
                userId: debtData.userId,
                debtModel: 'revolving_interest', // Identificador do modelo
                status: 'active',
                installmentsPaid: 0,
                createdAt: Timestamp.now()
            };
        } else {
            // Modelo de Parcelas Fixas (legado)
            dataToSave = {
                ...debtData,
                startDate: Timestamp.fromDate(new Date(debtData.startDate + 'T00:00:00')),
                contractDate: Timestamp.fromDate(new Date(debtData.contractDate + 'T00:00:00')),
                interestRate: debtData.interestRate || 0,
                amountPaid: 0,
                installmentsPaid: 0,
                status: 'active',
                debtModel: 'fixed_installments', // Identificador do modelo
                createdAt: Timestamp.now()
            };
        }
        // --- FIM DA ALTERAÇÃO ---

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
            orderBy("status"), 
            orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);
        const debts = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            debts.push({
                id: doc.id,
                ...data,
                // Garante compatibilidade com datas que podem não existir no modelo novo
                startDate: data.startDate ? data.startDate.toDate() : null,
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
 * Registra o pagamento de uma parcela de uma dívida de parcelas fixas.
 * @param {object} debt - O objeto completo da dívida.
 * @param {object} paymentDetails - Detalhes do pagamento.
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

// --- INÍCIO DA ALTERAÇÃO: NOVA FUNÇÃO DE PAGAMENTO ---
/**
 * Registra o pagamento de uma parcela de uma dívida de juros rotativo.
 * @param {string} debtId - O ID da dívida.
 * @param {object} paymentData - Dados do pagamento, incluindo taxa SELIC.
 * @returns {Promise<void>}
 */
async function payRevolvingDebtInstallment(debtId, paymentData) {
    const { paymentAmount, selicRate, paymentDate, accountId } = paymentData;
    const debtRef = doc(db, COLLECTIONS.DEBTS, debtId);

    try {
        await runTransaction(db, async (transaction) => {
            const debtSnap = await transaction.get(debtRef);
            if (!debtSnap.exists()) {
                throw new Error("Dívida não encontrada.");
            }
            const debtData = debtSnap.data();

            // Cálculos baseados na planilha
            const currentBalance = debtData.currentBalance;
            const interestValue = currentBalance * (selicRate / 100);
            const totalBalanceWithInterest = currentBalance + interestValue;
            const newBalance = totalBalanceWithInterest - paymentAmount;

            // Atualiza o documento principal da dívida
            transaction.update(debtRef, {
                currentBalance: newBalance,
                installmentsPaid: increment(1)
            });

            // Cria o registro detalhado da parcela na subcoleção
            const installmentRef = doc(collection(debtRef, 'installments'));
            const installmentData = {
                installmentNumber: (debtData.installmentsPaid || 0) + 1,
                initialBalanceForPeriod: currentBalance,
                selicRate: selicRate,
                interestValue: interestValue,
                totalBalanceWithInterest: totalBalanceWithInterest,
                paymentAmount: paymentAmount,
                finalBalance: newBalance,
                paymentDate: Timestamp.fromDate(new Date(paymentDate + 'T00:00:00')),
                createdAt: Timestamp.now()
            };
            transaction.set(installmentRef, installmentData);

            // Cria a transação financeira de despesa (se houver conta)
            if (accountId) {
                const financialTransactionRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
                const financialTransactionData = {
                    description: `Pagamento Parcela - ${debtData.description}`,
                    amount: paymentAmount,
                    type: 'expense',
                    category: debtData.category,
                    paymentMethod: 'debit',
                    userId: debtData.userId,
                    accountId: accountId,
                    date: Timestamp.fromDate(new Date(paymentDate + 'T00:00:00')),
                    createdAt: Timestamp.now()
                };
                transaction.set(financialTransactionRef, financialTransactionData);

                // Debita o valor da conta
                const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
                transaction.update(accountRef, { currentBalance: increment(-paymentAmount) });
            }
        });
    } catch (error) {
        console.error("Erro ao registrar pagamento de parcela rotativa:", error);
        throw new Error("Ocorreu um erro ao registrar o pagamento da parcela.");
    }
}
// --- FIM DA ALTERAÇÃO ---

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
                .reduce((sum, d) => sum + (d.initialAmount || d.totalAmount), 0); // Suporta ambos modelos

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

function getDebtCompositionData(userDebts) {
    const composition = userDebts
        .filter(d => d.status === 'active')
        .reduce((acc, debt) => {
            const balance = debt.debtModel === 'revolving_interest' 
                ? debt.currentBalance 
                : debt.totalAmount - (debt.amountPaid || 0);
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

async function createRecurringTransactionForDebt(debtData) {
    if (debtData.paymentMethod === 'account_debit' || debtData.paymentMethod === 'payroll') {
        try {
            // Só cria recorrência para o modelo de parcelas fixas por enquanto
            if(debtData.debtModel === 'fixed_installments') {
                const recurringData = {
                    description: `Recorrência - Pagamento Parcela - ${debtData.description}`,
                    amount: debtData.installmentAmount,
                    dayOfMonth: debtData.dueDay,
                    type: 'expense',
                    category: debtData.category,
                    paymentMethod: 'account_debit', 
                    accountId: null, 
                    cardId: null,
                    userId: debtData.userId,
                };
                
                if (confirm("Deseja criar uma transação recorrente automática para o pagamento desta dívida?")) {
                    await addRecurringTransaction(recurringData);
                    return "Recorrência para a dívida criada com sucesso!";
                }
            }
        } catch (error) {
            console.error("Erro ao criar recorrência para a dívida:", error);
            return "A dívida foi salva, mas ocorreu um erro ao tentar criar a recorrência automática.";
        }
    }
    return null;
}

export { addDebt, getDebts, payDebtInstallment, getDebtEvolutionData, getDebtCompositionData, createRecurringTransactionForDebt, payRevolvingDebtInstallment };
