// js/modules/admin/systemReset.js

/**
 * Módulo exclusivo para a funcionalidade de reset de dados do sistema.
 * Contém funções altamente destrutivas que devem ser usadas com extremo cuidado.
 */

import { db } from '../../firebase-config.js';
import { COLLECTIONS } from '../../config/constants.js';
import { createDefaultCategoriesForUser } from '../categories.js';
import {
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    collectionGroup
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Exclui todos os documentos de uma consulta em lotes de 500.
 * @param {Query} q - A consulta do Firestore cujos documentos serão excluídos.
 */
async function deleteQueryResult(q) {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return;
    }

    const BATCH_SIZE = 500;
    let batch = writeBatch(db);
    let count = 0;

    for (const doc of querySnapshot.docs) {
        batch.delete(doc.ref);
        count++;
        if (count === BATCH_SIZE) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
    }
}

/**
 * Deleta todos os documentos de uma coleção principal pertencentes a um usuário.
 * @param {string} collectionName - O nome da coleção.
 * @param {string} userId - O ID do usuário.
 */
async function resetTopLevelCollection(collectionName, userId) {
    const collectionRef = collection(db, collectionName);
    const q = query(collectionRef, where("userId", "==", userId));
    await deleteQueryResult(q);
}

/**
 * Deleta todas as faturas e suas subcoleções de transações.
 * @param {string} userId - O ID do usuário.
 */
async function resetInvoices(userId) {
    // 1. Deleta todas as transações dentro das faturas (subcoleções)
    const invoiceTransactionsQuery = query(
        collectionGroup(db, COLLECTIONS.INVOICE_TRANSACTIONS),
        where("userId", "==", userId)
    );
    await deleteQueryResult(invoiceTransactionsQuery);

    // 2. Deleta as faturas principais
    await resetTopLevelCollection(COLLECTIONS.INVOICES, userId);
}

/**
 * Deleta todas as carteiras, seus ativos e todos os movimentos.
 * @param {string} userId - O ID do usuário.
 */
async function resetPortfolios(userId) {
    // 1. Deleta todos os movimentos (nível mais profundo)
    const movementsQuery = query(
        collectionGroup(db, 'movements'),
        where("userId", "==", userId)
    );
    await deleteQueryResult(movementsQuery);
    
    // 2. Deleta todos os ativos (nível intermediário)
    // A exclusão de subcoleções em massa é complexa, por isso deletamos os movimentos primeiro.
    // Agora precisamos iterar para deletar os ativos.
    const portfoliosRef = collection(db, COLLECTIONS.INVESTMENT_PORTFOLIOS);
    const userPortfoliosQuery = query(portfoliosRef, where("userId", "==", userId));
    const portfoliosSnapshot = await getDocs(userPortfoliosQuery);

    for (const portfolioDoc of portfoliosSnapshot.docs) {
        const assetsRef = collection(portfolioDoc.ref, 'assets');
        const assetsQuery = query(assetsRef);
        await deleteQueryResult(assetsQuery);
    }
    
    // 3. Deleta as contas do tipo 'investment' associadas
    const investmentAccountsQuery = query(
        collection(db, COLLECTIONS.ACCOUNTS),
        where("userId", "==", userId),
        where("type", "==", "investment")
    );
    await deleteQueryResult(investmentAccountsQuery);

    // 4. Deleta as carteiras (nível superior)
    await resetTopLevelCollection(COLLECTIONS.INVESTMENT_PORTFOLIOS, userId);
}


/**
 * Executa o reset dos dados do sistema com base nas opções selecionadas.
 * @param {object} options - Um objeto com chaves booleanas para cada tipo de dado a ser resetado.
 * @param {string} userId - O ID do usuário cujos dados serão resetados.
 */
export async function performSystemReset(options, userId) {
    if (!userId) {
        throw new Error("ID do usuário não fornecido. Operação abortada.");
    }
    if (!options || Object.values(options).every(v => v === false)) {
        throw new Error("Nenhuma opção de reset foi selecionada.");
    }

    try {
        if (options.transactions) await resetTopLevelCollection(COLLECTIONS.TRANSACTIONS, userId);
        if (options.accounts) await resetTopLevelCollection(COLLECTIONS.ACCOUNTS, userId);
        if (options.creditCards) await resetTopLevelCollection(COLLECTIONS.CREDIT_CARDS, userId);
        if (options.recurring) await resetTopLevelCollection(COLLECTIONS.RECURRING_TRANSACTIONS, userId);
        if (options.budgets) await resetTopLevelCollection(COLLECTIONS.BUDGETS, userId);
        
        // Lógica para coleções com subcoleções
        if (options.invoices) await resetInvoices(userId);
        if (options.portfolios) await resetPortfolios(userId);

        // Categorias são tratadas por último para recriação
        if (options.categories) {
            await resetTopLevelCollection(COLLECTIONS.CATEGORIES, userId);
            await createDefaultCategoriesForUser(userId);
        }

    } catch (error) {
        console.error("Erro catastrófico durante o reset do sistema:", error);
        throw new Error(`Falha durante o processo de reset: ${error.message}`);
    }
}
