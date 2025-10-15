// js/modules/invoices.js

// Importa a instância do Firestore e funções necessárias.
import { db } from '../firebase-config.js';
// INÍCIO DA ALTERAÇÃO - Correção para caminho relativo
import { COLLECTIONS } from '../config/constants.js';
// FIM DA ALTERAÇÃO
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    Timestamp,
    orderBy,
    doc,
    updateDoc,
    writeBatch,
    getDoc,
    increment
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

import { updateBalanceInBatch } from './accounts.js';

/**
 * Determina o mês e ano de uma fatura com base na data da transação e no dia de fechamento do cartão.
 * @param {Date} transactionDate - A data em que a transação foi realizada.
 * @param {number} closingDay - O dia de fechamento do cartão.
 * @returns {{month: number, year: number}} O mês (1-12) e o ano da fatura correspondente.
 */
function getInvoicePeriod(transactionDate, closingDay) {
    const invoiceDate = new Date(transactionDate.getTime());
    const transactionDay = transactionDate.getDate();

    if (transactionDay > closingDay) {
        invoiceDate.setMonth(invoiceDate.getMonth() + 1);
    }

    return {
        month: invoiceDate.getMonth() + 1,
        year: invoiceDate.getFullYear()
    };
}

/**
 * Encontra uma fatura existente para um cartão em um determinado período ou cria uma nova se não existir.
 * @param {string} cardId - O ID do cartão de crédito.
 * @param {object} cardData - O objeto completo do cartão.
 * @param {string} userId - O ID do usuário.
 * @param {Date} transactionDate - A data da transação para determinar o período da fatura.
 * @returns {Promise<string>} O ID do documento da fatura.
 */
async function findOrCreateInvoice(cardId, cardData, userId, transactionDate) {
    const { month, year } = getInvoicePeriod(transactionDate, cardData.closingDay);

    const invoicesRef = collection(db, COLLECTIONS.INVOICES);
    const q = query(invoicesRef,
        where("cardId", "==", cardId),
        where("userId", "==", userId),
        where("month", "==", month),
        where("year", "==", year)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        const invoiceDoc = querySnapshot.docs[0];
        return invoiceDoc.id;
    }
    
    const dueDate = new Date(year, month - 1, cardData.dueDay);

    const newInvoiceData = {
        cardId,
        userId,
        month,
        year,
        totalAmount: 0,
        status: 'open',
        createdAt: Timestamp.now(),
        dueDate: Timestamp.fromDate(dueDate)
    };

    const docRef = await addDoc(invoicesRef, newInvoiceData);
    return docRef.id;
}

/**
 * Busca todas as faturas de um cartão de crédito específico, ordenadas da mais recente para a mais antiga.
 * @param {string} cardId - O ID do cartão de crédito.
 * @param {string} userId - O ID do usuário para garantir a permissão.
 * @returns {Promise<Array>} Uma lista de objetos de fatura.
 */
async function getInvoices(cardId, userId) {
    try {
        const invoicesRef = collection(db, COLLECTIONS.INVOICES);
        const q = query(invoicesRef,
            where("cardId", "==", cardId),
            where("userId", "==", userId),
            orderBy("year", "desc"),
            orderBy("month", "desc")
        );
        const querySnapshot = await getDocs(q);
        const invoices = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            invoices.push({ id: doc.id, ...data, dueDate: data.dueDate.toDate() });
        });
        return invoices;
    } catch (error) {
        console.error("Erro ao buscar faturas:", error);
        throw new Error("Não foi possível carregar as faturas.");
    }
}

/**
 * Busca todos os lançamentos (transações) de uma fatura específica.
 * @param {string} invoiceId - O ID da fatura.
 * @returns {Promise<Array>} Uma lista de objetos de transação da fatura.
 */
async function getInvoiceTransactions(invoiceId) {
    try {
        const invoiceTransactionsRef = collection(db, COLLECTIONS.INVOICES, invoiceId, COLLECTIONS.INVOICE_TRANSACTIONS);
        const q = query(invoiceTransactionsRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const transactions = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            transactions.push({
                id: doc.id,
                ...data,
                purchaseDate: data.purchaseDate ? data.purchaseDate.toDate() : null
            });
        });
        return transactions;
    } catch (error) {
        console.error("Erro ao buscar lançamentos da fatura:", error);
        throw new Error("Não foi possível carregar os lançamentos da fatura.");
    }
}

/**
 * Marca uma fatura como paga, cria a transação de despesa correspondente e debita o saldo da conta.
 * @param {object} invoice - O objeto da fatura a ser paga.
 * @param {object} card - O objeto do cartão ao qual a fatura pertence.
 * @param {object} paymentDetails - Detalhes do pagamento.
 * @param {string} paymentDetails.accountId - ID da conta usada para o pagamento.
 * @param {string} paymentDetails.paymentDate - Data do pagamento no formato 'YYYY-MM-DD'.
 * @returns {Promise<void>}
 */
async function payInvoice(invoice, card, paymentDetails) {
    try {
        const { accountId, paymentDate } = paymentDetails;
        const batch = writeBatch(db);

        // 1. Marca a fatura como paga
        const invoiceRef = doc(db, COLLECTIONS.INVOICES, invoice.id);
        batch.update(invoiceRef, { status: 'paid' });

        // 2. Cria a transação de despesa correspondente ao pagamento
        const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
        const parsedPaymentDate = new Date(paymentDate + 'T00:00:00');

        const paymentTransactionData = {
            description: `Pagamento Fatura ${card.name} (${invoice.month}/${invoice.year})`,
            amount: invoice.totalAmount,
            type: 'expense',
            category: 'Fatura de Cartão',
            paymentMethod: 'debit', // Representa a saída de dinheiro da conta
            userId: invoice.userId,
            accountId: accountId, // Vincula a transação à conta de pagamento
            date: Timestamp.fromDate(parsedPaymentDate),
            createdAt: Timestamp.now()
        };
        const newTransactionRef = doc(transactionsRef);
        batch.set(newTransactionRef, paymentTransactionData);
        
        // 3. Debita o valor do saldo da conta selecionada
        updateBalanceInBatch(batch, accountId, invoice.totalAmount, 'expense');

        // 4. Executa todas as operações atomicamente
        await batch.commit();

    } catch (error) {
        console.error("Erro ao pagar fatura:", error);
        throw new Error("Ocorreu um erro ao registrar o pagamento da fatura.");
    }
}

/**
 * Realiza um pagamento parcial/antecipado de uma fatura.
 * @param {string} invoiceId - O ID da fatura.
 * @param {number} amount - O valor a ser pago.
 * @param {string} accountId - O ID da conta de origem do pagamento.
 * @param {string} date - A data do pagamento no formato 'YYYY-MM-DD'.
 * @returns {Promise<void>}
 */
async function makeAdvancePayment(invoiceId, amount, accountId, date) {
    const batch = writeBatch(db);
    const invoiceRef = doc(db, COLLECTIONS.INVOICES, invoiceId);

    try {
        // Validação para garantir que o valor não é negativo ou zero.
        if (amount <= 0) {
            throw new Error("O valor do pagamento deve ser positivo.");
        }
        
        const invoiceSnap = await getDoc(invoiceRef);
        if (!invoiceSnap.exists()) {
            throw new Error("Fatura não encontrada.");
        }
        const invoiceData = invoiceSnap.data();

        // Garante que o usuário não pague mais do que o valor restante
        if (amount > invoiceData.totalAmount) {
            throw new Error(`O valor do pagamento (R$ ${amount.toFixed(2)}) não pode ser maior que o saldo devedor da fatura (R$ ${invoiceData.totalAmount.toFixed(2)}).`);
        }

        // 1. Cria a transação de despesa para o pagamento antecipado
        const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
        const paymentDate = new Date(date + 'T00:00:00');

        const advancePaymentData = {
            description: `Pagamento antecipado Fatura (${invoiceData.month}/${invoiceData.year})`,
            amount: amount,
            type: 'expense',
            category: 'Fatura de Cartão',
            paymentMethod: 'debit',
            userId: invoiceData.userId,
            accountId: accountId,
            date: Timestamp.fromDate(paymentDate),
            createdAt: Timestamp.now()
        };
        const newTransactionRef = doc(transactionsRef);
        batch.set(newTransactionRef, advancePaymentData);

        // 2. Atualiza o saldo da conta de origem
        updateBalanceInBatch(batch, accountId, amount, 'expense');

        // 3. Abate o valor do total da fatura
        batch.update(invoiceRef, { totalAmount: increment(-amount) });

        await batch.commit();

    } catch (error) {
        console.error("Erro ao realizar pagamento antecipado:", error);
        // Lança o erro original para ser tratado no frontend
        throw error;
    }
}

/**
 * Atualiza um lançamento de cartão de crédito. Lida com a mudança de valor e a migração entre faturas.
 * @param {string} originalInvoiceId - O ID da fatura onde o lançamento está originalmente.
 * @param {string} transactionId - O ID do lançamento a ser atualizado.
 * @param {object} updatedData - Os novos dados do lançamento.
 * @param {object} card - O objeto do cartão de crédito.
 * @returns {Promise<void>}
 */
async function updateInvoiceTransaction(originalInvoiceId, transactionId, updatedData, card) {
    const batch = writeBatch(db);
    const originalInvoiceRef = doc(db, COLLECTIONS.INVOICES, originalInvoiceId);
    const transactionRef = doc(originalInvoiceRef, COLLECTIONS.INVOICE_TRANSACTIONS, transactionId);

    try {
        const originalTxSnap = await getDoc(transactionRef);
        if (!originalTxSnap.exists()) {
            throw new Error("Lançamento original não encontrado.");
        }
        const originalAmount = originalTxSnap.data().amount;

        const newPurchaseDate = new Date(updatedData.purchaseDate + 'T00:00:00');

        const newInvoiceId = await findOrCreateInvoice(card.id, card, card.userId, newPurchaseDate);

        const dataToSave = {
            ...updatedData,
            purchaseDate: Timestamp.fromDate(newPurchaseDate)
        };

        if (originalInvoiceId === newInvoiceId) {
            const amountDifference = dataToSave.amount - originalAmount;
            batch.update(transactionRef, dataToSave);
            batch.update(originalInvoiceRef, { totalAmount: increment(amountDifference) });
        } else {
            const newInvoiceRef = doc(db, COLLECTIONS.INVOICES, newInvoiceId);
            
            batch.update(originalInvoiceRef, { totalAmount: increment(-originalAmount) });
            batch.delete(transactionRef);

            const newTransactionRef = doc(collection(newInvoiceRef, COLLECTIONS.INVOICE_TRANSACTIONS));
            batch.set(newTransactionRef, dataToSave);
            batch.update(newInvoiceRef, { totalAmount: increment(dataToSave.amount) });
        }

        await batch.commit();
    } catch (error) {
        console.error("Erro ao atualizar lançamento da fatura:", error);
        throw new Error("Não foi possível salvar as alterações no lançamento.");
    }
}

/**
 * Verifica todas as faturas abertas de um usuário e fecha aquelas cuja data de vencimento já passou.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<void>}
 */
async function closeOverdueInvoices(userId) {
    try {
        const invoicesRef = collection(db, COLLECTIONS.INVOICES);
        const now = new Date();

        const q = query(invoicesRef,
            where("userId", "==", userId),
            where("status", "==", "open"),
            where("dueDate", "<", Timestamp.fromDate(now))
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return;
        }

        const batch = writeBatch(db);
        querySnapshot.forEach((doc) => {
            const invoiceRef = doc.ref;
            batch.update(invoiceRef, { status: 'closed' });
        });

        await batch.commit();
        console.log(`${querySnapshot.size} fatura(s) foram fechadas.`);
    } catch (error) {
        console.error("Erro ao fechar faturas vencidas:", error);
    }
}

export { findOrCreateInvoice, getInvoices, getInvoiceTransactions, payInvoice, closeOverdueInvoices, updateInvoiceTransaction, makeAdvancePayment };
