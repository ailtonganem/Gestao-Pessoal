// Importa a instância do Firestore e funções necessárias.
import { db } from '../firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const INVOICES_COLLECTION = 'invoices';

/**
 * Determina o mês e ano de uma fatura com base na data da transação e no dia de fechamento do cartão.
 * A fatura é geralmente associada ao mês de seu vencimento.
 * @param {Date} transactionDate - A data em que a transação foi realizada.
 * @param {number} closingDay - O dia de fechamento do cartão.
 * @returns {{month: number, year: number}} O mês (1-12) e o ano da fatura correspondente.
 */
function getInvoicePeriod(transactionDate, closingDay) {
    // Clona a data para não modificar a original
    const invoiceDate = new Date(transactionDate.getTime());
    const transactionDay = transactionDate.getDate();

    // Se a compra foi feita APÓS o dia de fechamento, ela entra na fatura do mês seguinte.
    if (transactionDay > closingDay) {
        invoiceDate.setMonth(invoiceDate.getMonth() + 1);
    }

    return {
        month: invoiceDate.getMonth() + 1, // getMonth() é 0-11, então adicionamos 1
        year: invoiceDate.getFullYear()
    };
}

/**
 * Encontra uma fatura existente para um cartão em um determinado período ou cria uma nova se não existir.
 * @param {string} cardId - O ID do cartão de crédito.
 * @param {object} cardData - O objeto completo do cartão (para obter closingDay e dueDay).
 * @param {string} userId - O ID do usuário.
 * @param {Date} transactionDate - A data da transação para determinar o período da fatura.
 * @returns {Promise<string>} O ID do documento da fatura (existente ou nova).
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

    // Se a fatura já existe, retorna o ID dela.
    if (!querySnapshot.empty) {
        const invoiceDoc = querySnapshot.docs[0];
        console.log(`Fatura existente encontrada: ${invoiceDoc.id}`);
        return invoiceDoc.id;
    }

    // Se não existe, cria uma nova.
    console.log(`Nenhuma fatura encontrada para ${month}/${year}. Criando uma nova...`);
    
    // Calcula a data de vencimento da nova fatura
    const dueDate = new Date(year, month - 1, cardData.dueDay);

    const newInvoiceData = {
        cardId,
        userId,
        month,
        year,
        totalAmount: 0, // A fatura começa com valor zero
        status: 'open', // Status pode ser 'open', 'closed', 'paid'
        createdAt: Timestamp.now(),
        dueDate: Timestamp.fromDate(dueDate)
    };

    const docRef = await addDoc(invoicesRef, newInvoiceData);
    console.log(`Nova fatura criada com ID: ${docRef.id}`);
    return docRef.id;
}

// Exporta as funções para serem utilizadas em outros módulos.
export { findOrCreateInvoice };
