// Importa a instância do Firestore e funções necessárias.
import { db } from '../firebase-config.js';
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

const INVOICES_COLLECTION = 'invoices';
const TRANSACTIONS_COLLECTION = 'transactions';

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

    const invoicesRef = collection(db, INVOICES_COLLECTION);
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
 * @returns {Promise<Array>} Uma lista de objetos de fatura.
 */
async function getInvoices(cardId) {
    try {
        const invoicesRef = collection(db, INVOICES_COLLECTION);
        const q = query(invoicesRef,
            where("cardId", "==", cardId),
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
        const invoiceTransactionsRef = collection(db, INVOICES_COLLECTION, invoiceId, 'transactions');
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
 * Marca uma fatura como paga e cria a transação de despesa correspondente.
 * @param {object} invoice - O objeto da fatura a ser paga.
 * @param {object} card - O objeto do cartão ao qual a fatura pertence.
 * @returns {Promise<void>}
 */
async function payInvoice(invoice, card) {
    try {
        const batch = writeBatch(db);

        const invoiceRef = doc(db, INVOICES_COLLECTION, invoice.id);
        batch.update(invoiceRef, { status: 'paid' });

        const transactionsRef = collection(db, TRANSACTIONS_COLLECTION);
        const paymentTransactionData = {
            description: `Pagamento Fatura ${card.name} (${invoice.month}/${invoice.year})`,
            amount: invoice.totalAmount,
            type: 'expense',
            category: 'Fatura de Cartão',
            paymentMethod: 'debit',
            userId: invoice.userId,
            date: Timestamp.now(), // Adicionando a data do pagamento
            createdAt: Timestamp.now()
        };
        const newTransactionRef = doc(transactionsRef);
        batch.set(newTransactionRef, paymentTransactionData);
        
        await batch.commit();

    } catch (error) {
        console.error("Erro ao pagar fatura:", error);
        throw new Error("Ocorreu um erro ao registrar o pagamento da fatura.");
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
    const originalInvoiceRef = doc(db, INVOICES_COLLECTION, originalInvoiceId);
    const transactionRef = doc(originalInvoiceRef, 'transactions', transactionId);

    try {
        const originalTxSnap = await getDoc(transactionRef);
        if (!originalTxSnap.exists()) {
            throw new Error("Lançamento original não encontrado.");
        }
        const originalAmount = originalTxSnap.data().amount;

        // Converte a data do formulário para um objeto Date do JS
        const newPurchaseDate = new Date(updatedData.purchaseDate + 'T00:00:00');

        // Determina a qual fatura o lançamento pertence com a nova data
        const newInvoiceId = await findOrCreateInvoice(card.id, card, card.userId, newPurchaseDate);

        // Prepara os dados para salvar, garantindo que a data seja um Timestamp
        const dataToSave = {
            ...updatedData,
            purchaseDate: Timestamp.fromDate(newPurchaseDate)
        };

        if (originalInvoiceId === newInvoiceId) {
            // Caso 1: A transação permanece na mesma fatura
            const amountDifference = dataToSave.amount - originalAmount;
            batch.update(transactionRef, dataToSave);
            batch.update(originalInvoiceRef, { totalAmount: increment(amountDifference) });
        } else {
            // Caso 2: A transação muda de fatura
            const newInvoiceRef = doc(db, INVOICES_COLLECTION, newInvoiceId);
            
            // Remove da fatura antiga
            batch.update(originalInvoiceRef, { totalAmount: increment(-originalAmount) });
            batch.delete(transactionRef);

            // Adiciona na fatura nova
            const newTransactionRef = doc(collection(newInvoiceRef, 'transactions'));
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
        const invoicesRef = collection(db, INVOICES_COLLECTION);
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

export { findOrCreateInvoice, getInvoices, getInvoiceTransactions, payInvoice, closeOverdueInvoices, updateInvoiceTransaction };
