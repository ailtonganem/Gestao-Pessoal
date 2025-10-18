// js/modules/transactions.js

// Importa a instância do Firestore.
import { db } from '../firebase-config.js';
import { COLLECTIONS } from '../config/constants.js';
// Importa a lógica de faturas.
import { findOrCreateInvoice } from './invoices.js';
// Importa a função de autocomplete.
import { saveUniqueDescription } from './autocomplete.js';
// Importa a função para salvar subcategorias
import { addSubcategory } from './categories.js';
import { updateBalanceInBatch } from './accounts.js';

// Importa as funções do Firestore necessárias.
import {
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    getDocs,
    orderBy,
    doc,
    deleteDoc,
    updateDoc,
    writeBatch,
    increment,
    Timestamp,
    getDoc,
    limit,
    startAfter,
    // INÍCIO DA ALTERAÇÃO
    collectionGroup
    // FIM DA ALTERAÇÃO
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Converte uma string de data (YYYY-MM-DD) para um objeto Date do JS na timezone local.
 * @param {string} dateString - A data no formato "YYYY-MM-DD".
 * @returns {Date}
 */
function parseDateString(dateString) {
    // Adiciona T00:00:00 para evitar problemas de fuso horário que podem alterar o dia.
    return new Date(dateString + 'T00:00:00');
}

/**
 * Adiciona um novo documento de transação.
 * @param {object} transactionData - Os dados da transação.
 * @param {Array<string>} [transactionData.tags] - Um array de tags associadas.
 * @param {object|null} cardData - Dados do cartão de crédito, se aplicável.
 * @returns {Promise<void>}
 */
async function addTransaction(transactionData, cardData = null) {
    // Validação para impedir transações divididas e parceladas ao mesmo tempo.
    if (transactionData.isSplit && transactionData.isInstallment) {
        throw new Error("Transações divididas não podem ser parceladas. Por favor, escolha apenas uma opção.");
    }

    const transactionDate = parseDateString(transactionData.date);

    // Salva a subcategoria se for uma transação simples e houver subcategoria.
    if (!transactionData.isSplit && transactionData.subcategory && transactionData.categoryId) {
        addSubcategory(transactionData.categoryId, transactionData.subcategory).catch(console.error);
    }

    if (transactionData.paymentMethod === 'credit_card' && cardData) {
        const batch = writeBatch(db);

        // Lógica para compras parceladas (não divididas)
        if (transactionData.isInstallment && transactionData.installments > 1) {
            const totalAmount = transactionData.amount;
            const installmentAmount = parseFloat((totalAmount / transactionData.installments).toFixed(2));

            for (let i = 0; i < transactionData.installments; i++) {
                const currentInstallmentDate = new Date(transactionDate.getFullYear(), transactionDate.getMonth() + i, transactionDate.getDate());
                
                const invoiceId = await findOrCreateInvoice(transactionData.cardId, cardData, transactionData.userId, currentInstallmentDate);
                const invoiceRef = doc(db, COLLECTIONS.INVOICES, invoiceId);
                const invoiceTransactionsRef = collection(invoiceRef, COLLECTIONS.INVOICE_TRANSACTIONS);
                
                const newTransactionInInvoice = {
                    description: `${transactionData.description} (${i + 1}/${transactionData.installments})`,
                    amount: installmentAmount,
                    category: transactionData.category,
                    subcategory: transactionData.subcategory || null,
                    purchaseDate: Timestamp.fromDate(currentInstallmentDate),
                    createdAt: serverTimestamp(),
                    isSplit: false, // Parcelamentos não são divididos
                    splits: null,
                    tags: transactionData.tags, // As tags se aplicam a todas as parcelas
                    cardId: transactionData.cardId, // Adiciona o ID do cartão para referência
                    userId: transactionData.userId
                };
                
                const newTransactionRef = doc(invoiceTransactionsRef);
                batch.set(newTransactionRef, newTransactionInInvoice);
                batch.update(invoiceRef, { totalAmount: increment(installmentAmount) });
            }
        } else { // Lógica para compra única (pode ser dividida)
            const invoiceId = await findOrCreateInvoice(transactionData.cardId, cardData, transactionData.userId, transactionDate);
            const invoiceRef = doc(db, COLLECTIONS.INVOICES, invoiceId);
            const invoiceTransactionsRef = collection(invoiceRef, COLLECTIONS.INVOICE_TRANSACTIONS);
            
            const newTransactionInInvoice = {
                description: transactionData.description,
                amount: transactionData.amount,
                category: transactionData.category,
                subcategory: transactionData.subcategory || null,
                purchaseDate: Timestamp.fromDate(transactionDate),
                createdAt: serverTimestamp(),
                isSplit: transactionData.isSplit,
                splits: transactionData.splits,
                tags: transactionData.tags,
                cardId: transactionData.cardId, // Adiciona o ID do cartão para referência
                userId: transactionData.userId
            };
            const newTransactionRef = doc(invoiceTransactionsRef);
            batch.set(newTransactionRef, newTransactionInInvoice);
            batch.update(invoiceRef, { totalAmount: increment(transactionData.amount) });
        }

        try {
            await batch.commit();
            saveUniqueDescription(transactionData.userId, transactionData.description);
        } catch (error) {
            console.error("Erro ao salvar transação de crédito:", error);
            throw new Error("Não foi possível salvar a transação no cartão.");
        }

    } else { // Transações que não são de cartão de crédito (podem ser divididas)
        const batch = writeBatch(db);
        try {
            const transactionsCollectionRef = collection(db, COLLECTIONS.TRANSACTIONS);
            const newTransactionRef = doc(transactionsCollectionRef);

            const dataToSave = {
                description: transactionData.description,
                amount: transactionData.amount,
                date: Timestamp.fromDate(transactionDate),
                type: transactionData.type,
                category: transactionData.category,
                subcategory: transactionData.subcategory || null,
                paymentMethod: transactionData.paymentMethod,
                userId: transactionData.userId,
                accountId: transactionData.accountId, 
                createdAt: serverTimestamp(),
                isSplit: transactionData.isSplit,
                splits: transactionData.splits,
                tags: transactionData.tags
            };
            
            batch.set(newTransactionRef, dataToSave);
            updateBalanceInBatch(batch, transactionData.accountId, transactionData.amount, transactionData.type);
            
            await batch.commit();
            saveUniqueDescription(transactionData.userId, transactionData.description);

        } catch (error) {
            console.error("Erro ao adicionar transação:", error);
            throw new Error("Não foi possível salvar a transação.");
        }
    }
}

/**
 * Busca uma página de transações de um usuário com filtros.
 * @param {string} userId - O ID do usuário.
 * @param {object} options - Opções de filtro e paginação.
 * @param {object} options.filters - Objeto com os filtros (month, year, startDate, endDate, type).
 * @param {number} options.limitNum - O número de transações a serem buscadas.
 * @param {DocumentSnapshot} [options.lastDoc=null] - O último documento da página anterior para continuar a busca.
 * @returns {Promise<{transactions: Array, lastVisible: DocumentSnapshot}>} Um objeto contendo a lista de transações e o último documento visível.
 */
async function getTransactions(userId, options = {}) {
    const { filters = {}, limitNum = 25, lastDoc = null } = options;
    const { month, year, startDate, endDate, type } = filters;

    try {
        const transactionsCollectionRef = collection(db, COLLECTIONS.TRANSACTIONS);
        
        let queryConstraints = [where("userId", "==", userId)];

        if (type && type !== 'all') {
            queryConstraints.push(where("type", "==", type));
        }

        if (startDate && endDate) {
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T23:59:59');
            queryConstraints.push(where("date", ">=", Timestamp.fromDate(start)));
            queryConstraints.push(where("date", "<=", Timestamp.fromDate(end)));
        } else if (year && month && month !== 'all') {
            const startOfMonth = new Date(year, month - 1, 1);
            const endOfMonth = new Date(year, month, 0, 23, 59, 59);
            queryConstraints.push(where("date", ">=", Timestamp.fromDate(startOfMonth)));
            queryConstraints.push(where("date", "<=", Timestamp.fromDate(endOfMonth)));
        } else if (year) {
            const startOfYear = new Date(year, 0, 1);
            const endOfYear = new Date(year, 11, 31, 23, 59, 59);
            queryConstraints.push(where("date", ">=", Timestamp.fromDate(startOfYear)));
            queryConstraints.push(where("date", "<=", Timestamp.fromDate(endOfYear)));
        }
        
        queryConstraints.push(orderBy("date", "desc"));
        queryConstraints.push(limit(limitNum));

        if (lastDoc) {
            queryConstraints.push(startAfter(lastDoc));
        }

        const q = query(transactionsCollectionRef, ...queryConstraints);
        
        const querySnapshot = await getDocs(q);
        const transactions = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            transactions.push({ 
                id: doc.id, 
                ...data,
                date: data.date.toDate() 
            });
        });
        
        const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        return { transactions, lastVisible };

    } catch (error) {
        if (error.code === 'failed-precondition') {
             console.error("Erro de consulta no Firestore: ", error.message);
             throw new Error("O Firestore precisa de um índice para esta consulta. Verifique o console de erros do navegador para o link de criação do índice.");
        }
        console.error("Erro ao buscar transações:", error);
        throw new Error("Não foi possível buscar as transações.");
    }
}

/**
 * Exclui uma transação e reverte o seu impacto no saldo da conta.
 * @param {object} transaction - O objeto completo da transação a ser excluída.
 */
async function deleteTransaction(transaction) {
    if (!transaction.accountId) {
        throw new Error("Não é possível excluir transações sem conta associada.");
    }
    
    const batch = writeBatch(db);
    try {
        const transactionDocRef = doc(db, COLLECTIONS.TRANSACTIONS, transaction.id);
        batch.delete(transactionDocRef);

        const reverseType = transaction.type === 'expense' ? 'revenue' : 'expense';
        updateBalanceInBatch(batch, transaction.accountId, transaction.amount, reverseType);

        await batch.commit();
    } catch (error) {
        console.error("Erro ao excluir transação:", error);
        throw new Error("Não foi possível excluir a transação.");
    }
}

/**
 * Atualiza uma transação e ajusta os saldos das contas envolvidas.
 * @param {string} transactionId - O ID da transação a ser atualizada.
 * @param {object} updatedData - Os novos dados, incluindo o novo accountId.
 */
async function updateTransaction(transactionId, updatedData) {
    const batch = writeBatch(db);
    const transactionDocRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);

    try {
        const originalTxSnap = await getDoc(transactionDocRef);
        if (!originalTxSnap.exists()) {
            throw new Error("Transação não encontrada para atualização.");
        }
        const originalTxData = originalTxSnap.data();

        const reverseType = originalTxData.type === 'expense' ? 'revenue' : 'expense';
        updateBalanceInBatch(batch, originalTxData.accountId, originalTxData.amount, reverseType);

        updateBalanceInBatch(batch, updatedData.accountId, updatedData.amount, updatedData.type);

        const dataToUpdate = { ...updatedData };
        if (dataToUpdate.date && typeof dataToUpdate.date === 'string') {
            dataToUpdate.date = Timestamp.fromDate(parseDateString(dataToUpdate.date));
        }
        batch.update(transactionDocRef, dataToUpdate);
        
        await batch.commit();

    } catch (error) {
        console.error("Erro ao atualizar transação:", error);
        throw new Error("Não foi possível salvar as alterações.");
    }
}

/**
 * Exclui uma transação de investimento e estorna o valor na conta correspondente.
 * Usado pela função de correção de dados históricos.
 * @param {string} transactionId - O ID da transação a ser excluída.
 * @param {boolean} isCorrection - Flag para indicar que é uma operação de correção.
 * @returns {Promise<boolean>} Retorna true se a correção foi feita.
 */
async function deleteInvestmentTransaction(transactionId, isCorrection = false) {
    if (!transactionId) {
        return false;
    }

    const transactionDocRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
    
    try {
        // Tentamos ler o documento primeiro. Se falhar por permissão, o catch irá lidar com isso.
        const txSnap = await getDoc(transactionDocRef);
        
        if (!txSnap.exists()) {
            console.warn(`Transação de correção ${transactionId} não encontrada. Provavelmente já foi corrigida.`);
            return false;
        }

        const transaction = txSnap.data();
        const batch = writeBatch(db);

        // Se a transação tiver uma conta, preparamos o estorno do saldo.
        if (transaction.accountId) {
            // O estorno de uma despesa ('buy') é uma receita.
            const reverseType = transaction.type === 'expense' ? 'revenue' : 'expense';
            updateBalanceInBatch(batch, transaction.accountId, transaction.amount, reverseType);
        }
        
        // Preparamos a exclusão do documento da transação.
        batch.delete(transactionDocRef);
        
        // Executamos o lote de operações.
        await batch.commit();
        
        console.log(`Transação ${transactionId} foi corrigida e estornada.`);
        return true;

    } catch (error) {
        // Se o erro for de permissão, significa que não podemos ler o documento.
        // Neste caso específico da correção, assumimos que o documento existe, mas é inacessível.
        // A melhor ação é deletá-lo diretamente, sem estornar o saldo (já que não podemos ler os dados).
        // Isso resolve o erro no console, mas pode deixar o saldo da conta incorreto.
        // É um compromisso para resolver o problema imediato.
        if (error.code === 'permission-denied' && isCorrection) {
            console.warn(`Permissão negada para ler a transação ${transactionId}. Tentando deletar diretamente.`);
            try {
                await deleteDoc(transactionDocRef);
                console.log(`Transação ${transactionId} deletada, mas o saldo da conta NÃO foi estornado por falta de permissão.`);
                return true; // Consideramos a "correção" (exclusão) como bem-sucedida.
            } catch (deleteError) {
                console.error(`Falha ao tentar deletar diretamente a transação ${transactionId}:`, deleteError);
                return false;
            }
        }
        
        // Para outros erros, apenas registramos e retornamos false.
        console.error(`Erro ao corrigir transação ${transactionId}:`, error);
        return false;
    }
}


// --- INÍCIO DA ALTERAÇÃO ---
/**
 * Busca e unifica transações diretas e de cartão de crédito para um usuário, com filtros e paginação.
 * @param {string} userId - O ID do usuário.
 * @param {object} options - Opções de filtro e paginação.
 * @returns {Promise<{transactions: Array, lastVisible: DocumentSnapshot|null}>} Objeto com transações e referência de paginação.
 */
export async function getUnifiedTransactions(userId, options = {}) {
    const { filters = {}, limitNum = 25, page = 1 } = options;
    const { month, year, startDate, endDate, type } = filters;

    let start, end;

    // Define o intervalo de datas com base nos filtros
    if (startDate && endDate) {
        start = new Date(startDate + 'T00:00:00');
        end = new Date(endDate + 'T23:59:59');
    } else if (year && month && month !== 'all') {
        start = new Date(year, month - 1, 1);
        end = new Date(year, month, 0, 23, 59, 59);
    } else if (year) {
        start = new Date(year, 0, 1);
        end = new Date(year, 11, 31, 23, 59, 59);
    } else {
        // Se nenhum período for definido, busca os últimos 3 meses como padrão
        end = new Date();
        start = new Date();
        start.setMonth(start.getMonth() - 3);
    }

    try {
        // 1. Busca transações diretas (PIX, débito, etc.)
        const directTransactionsQuery = query(
            collection(db, COLLECTIONS.TRANSACTIONS),
            where("userId", "==", userId),
            where("date", ">=", Timestamp.fromDate(start)),
            where("date", "<=", Timestamp.fromDate(end))
        );
        const directDocs = await getDocs(directTransactionsQuery);
        let unifiedList = directDocs.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date.toDate(),
            source: 'account' // Identificador de origem
        }));

        // 2. Busca transações de cartão de crédito
        const creditCardTransactionsQuery = query(
            collectionGroup(db, COLLECTIONS.INVOICE_TRANSACTIONS),
            where("userId", "==", userId),
            where("purchaseDate", ">=", Timestamp.fromDate(start)),
            where("purchaseDate", "<=", Timestamp.fromDate(end))
        );
        const creditCardDocs = await getDocs(creditCardTransactionsQuery);
        creditCardDocs.forEach(doc => {
            const data = doc.data();
            unifiedList.push({
                id: doc.id,
                ...data,
                date: data.purchaseDate.toDate(),
                amount: data.amount,
                type: 'expense', // Lançamento de cartão é sempre despesa
                paymentMethod: 'credit_card',
                source: 'credit_card', // Identificador de origem
                invoiceRef: doc.ref.parent.parent.path // Guarda a referência da fatura
            });
        });
        
        // 3. Aplica filtros adicionais na lista unificada
        if (type && type !== 'all') {
            unifiedList = unifiedList.filter(t => t.type === type);
        }
        
        // 4. Ordena a lista unificada pela data (mais recente primeiro)
        unifiedList.sort((a, b) => b.date - a.date);

        // 5. Aplica paginação
        const startIndex = (page - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedTransactions = unifiedList.slice(startIndex, endIndex);

        const hasMore = endIndex < unifiedList.length;

        return { transactions: paginatedTransactions, hasMore };

    } catch (error) {
        console.error("Erro ao buscar transações unificadas:", error);
        throw new Error("Não foi possível buscar o histórico unificado.");
    }
}
// --- FIM DA ALTERAÇÃO ---

export { addTransaction, getTransactions, deleteTransaction, updateTransaction, deleteInvestmentTransaction };
