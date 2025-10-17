// js/modules/investments/movements.js

/**
 * Módulo para gerenciar a lógica de negócio dos movimentos (operações) de um ativo.
 */

import { db } from '../../firebase-config.js';
import { COLLECTIONS } from '../../config/constants.js';
import {
    collection,
    doc,
    addDoc,
    writeBatch,
    Timestamp,
    getDoc,
    increment,
    serverTimestamp,
    getDocs,
    query,
    orderBy,
    deleteDoc,
    runTransaction,
    collectionGroup,
    where
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Adiciona um movimento (compra/venda) a um ativo e atualiza todos os dados relacionados.
 * @param {string} portfolioId - O ID da carteira.
 * @param {string} assetId - O ID do ativo.
 * @param {object} movementData - Dados da operação.
 * @returns {Promise<void>}
 */
export async function addMovement(portfolioId, assetId, movementData) {
    const batch = writeBatch(db);

    try {
        const portfolioRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId);
        const assetRef = doc(portfolioRef, 'assets', assetId);
        const movementsRef = collection(assetRef, 'movements');

        const portfolioSnap = await getDoc(portfolioRef);
        if (!portfolioSnap.exists()) {
            throw new Error("Carteira não encontrada.");
        }
        const isOwnPortfolio = portfolioSnap.data().ownershipType === 'own';

        const assetSnap = await getDoc(assetRef);
        if (!assetSnap.exists()) {
            throw new Error("Ativo não encontrado para registrar a operação.");
        }
        const currentAsset = assetSnap.data();

        const { type, quantity, price, date, accountId, userId } = movementData;
        const totalCost = quantity * price;
        let transactionIdForMovement = null;

        if (isOwnPortfolio) {
            if (!accountId) {
                throw new Error("A conta para débito/crédito é obrigatória para carteiras próprias.");
            }
            const newTransactionRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
            transactionIdForMovement = newTransactionRef.id;

            const transactionType = type === 'buy' ? 'expense' : 'revenue';
            const transactionDescription = type === 'buy' ? `Compra de ${currentAsset.ticker}` : `Venda de ${currentAsset.ticker}`;
            
            const transactionData = {
                description: transactionDescription,
                amount: totalCost,
                date: Timestamp.fromDate(new Date(date + 'T00:00:00')),
                type: transactionType,
                category: "Investimentos",
                paymentMethod: transactionType === 'expense' ? 'debit' : 'credit',
                userId: userId,
                accountId: accountId,
                createdAt: serverTimestamp()
            };
            batch.set(newTransactionRef, transactionData);

            const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
            const amountToUpdate = transactionType === 'expense' ? -totalCost : totalCost;
            batch.update(accountRef, { currentBalance: increment(amountToUpdate) });
        }
        
        const newMovementData = {
            type,
            quantity,
            pricePerUnit: price,
            totalCost,
            date: Timestamp.fromDate(new Date(date + 'T00:00:00')),
            createdAt: serverTimestamp(),
            transactionId: transactionIdForMovement,
            userId: userId
        };
        const newMovementRef = doc(movementsRef);
        batch.set(newMovementRef, newMovementData);

        let newQuantity, newTotalInvested, newAveragePrice;

        if (type === 'buy') {
            newQuantity = currentAsset.quantity + quantity;
            newTotalInvested = currentAsset.totalInvested + totalCost;
            newAveragePrice = newQuantity > 0 ? newTotalInvested / newQuantity : 0;
            
            batch.update(portfolioRef, { totalInvested: increment(totalCost) });

        } else { // 'sell'
            if (quantity > currentAsset.quantity) {
                throw new Error("Não é possível vender mais ativos do que você possui.");
            }
            newQuantity = currentAsset.quantity - quantity;
            newTotalInvested = currentAsset.totalInvested - (quantity * currentAsset.averagePrice);
            newAveragePrice = currentAsset.averagePrice; 
            if (newQuantity === 0) {
                newTotalInvested = 0;
                newAveragePrice = 0;
            }

            batch.update(portfolioRef, { totalInvested: increment(-(quantity * currentAsset.averagePrice)) });
        }
        
        const assetUpdateData = {
            quantity: newQuantity,
            totalInvested: newTotalInvested,
            averagePrice: newAveragePrice
        };
        batch.update(assetRef, assetUpdateData);
        
        await batch.commit();

    } catch (error) {
        console.error("Erro ao registrar movimento:", error);
        throw error;
    }
}

/**
 * Busca todos os movimentos (operações) de um ativo específico.
 * @param {string} portfolioId - O ID da carteira.
 * @param {string} assetId - O ID do ativo.
 * @returns {Promise<Array<object>>} Uma lista de objetos de movimento, ordenados por data.
 */
export async function getMovements(portfolioId, assetId) {
    try {
        const movementsRef = collection(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId, 'assets', assetId, 'movements');
        const q = query(movementsRef, orderBy("date", "desc"));

        const querySnapshot = await getDocs(q);
        const movements = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            movements.push({
                id: doc.id,
                ...data,
                date: data.date.toDate()
            });
        });

        return movements;

    } catch (error) {
        console.error(`Erro ao buscar movimentos para o ativo ${assetId}:`, error);
        throw new Error("Não foi possível carregar o histórico de operações do ativo.");
    }
}

/**
 * Adiciona um provento a um ativo e cria a transação de receita correspondente.
 * @param {string} portfolioId - O ID da carteira.
 * @param {string} assetId - O ID do ativo.
 * @param {object} proventoData - Dados do provento.
 * @returns {Promise<void>}
 */
export async function addProvento(portfolioId, assetId, proventoData) {
    const batch = writeBatch(db);

    try {
        const portfolioRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId);
        const portfolioSnap = await getDoc(portfolioRef);
        if (!portfolioSnap.exists()) {
            throw new Error("Carteira não encontrada.");
        }
        const isOwnPortfolio = portfolioSnap.data().ownershipType === 'own';

        const assetRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId, 'assets', assetId);
        const movementsRef = collection(assetRef, 'movements');

        const assetSnap = await getDoc(assetRef);
        if (!assetSnap.exists()) {
            throw new Error("Ativo não encontrado para registrar o provento.");
        }
        const currentAsset = assetSnap.data();

        const { proventoType, paymentDate, totalAmount, accountId, userId } = proventoData;
        let transactionIdForMovement = null;

        if (isOwnPortfolio) {
            if (!accountId) {
                throw new Error("A conta de destino é obrigatória para carteiras próprias.");
            }
            const newTransactionRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
            transactionIdForMovement = newTransactionRef.id;

            const transactionData = {
                description: `${proventoType} de ${currentAsset.ticker}`,
                amount: totalAmount,
                date: Timestamp.fromDate(new Date(paymentDate + 'T00:00:00')),
                type: 'revenue',
                category: 'Investimentos', // Categoria genérica, pode ser melhorada
                subcategory: proventoType,
                paymentMethod: 'credit', // Provento é um crédito em conta
                userId: userId,
                accountId: accountId,
                createdAt: serverTimestamp()
            };
            batch.set(newTransactionRef, transactionData);

            const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
            batch.update(accountRef, { currentBalance: increment(totalAmount) });
        }

        const newMovementData = {
            type: 'provento',
            proventoType: proventoType,
            totalAmount: totalAmount,
            date: Timestamp.fromDate(new Date(paymentDate + 'T00:00:00')),
            createdAt: serverTimestamp(),
            transactionId: transactionIdForMovement,
            userId: userId
        };
        const newMovementRef = doc(movementsRef);
        batch.set(newMovementRef, newMovementData);
        
        await batch.commit();

    } catch (error) {
        console.error("Erro ao registrar provento:", error);
        throw new Error("Não foi possível salvar o registro do provento.");
    }
}

/**
 * Busca todos os movimentos do tipo 'provento' de um usuário.
 * Utiliza uma consulta de grupo de coleção para buscar em todas as subcoleções 'movements'.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<Array<object>>} Uma lista de objetos de provento.
 */
export async function getAllProventos(userId) {
    try {
        const movementsGroupRef = collectionGroup(db, 'movements');
        const q = query(
            movementsGroupRef,
            where("type", "==", "provento"),
            where("userId", "==", userId),
            orderBy("date", "desc")
        );
        const querySnapshot = await getDocs(q);
        const proventos = [];

        for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data();
            // Para obter o ticker, precisamos acessar o documento pai (ativo)
            const assetRef = docSnap.ref.parent.parent;
            if (assetRef) {
                const assetSnap = await getDoc(assetRef);
                if (assetSnap.exists()) {
                    data.ticker = assetSnap.data().ticker;
                    data.assetName = assetSnap.data().name;
                }
            }
            proventos.push({
                id: docSnap.id,
                ...data,
                date: data.date.toDate()
            });
        }
        return proventos;
    } catch (error) {
        console.error("Erro ao buscar todos os proventos:", error);
        if (error.code === 'failed-precondition') {
             throw new Error("O Firestore precisa de um índice para esta consulta. Verifique o console de erros para o link de criação.");
        }
        throw new Error("Não foi possível carregar os dados de proventos.");
    }
}

/**
 * Busca todas as transações de investimento (compra/venda) de um usuário.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<Array<object>>} Uma lista consolidada de todas as transações.
 */
export async function getAllInvestmentTransactions(userId) {
    try {
        const movementsGroupRef = collectionGroup(db, 'movements');
        const q = query(
            movementsGroupRef,
            where("type", "in", ["buy", "sell"]),
            where("userId", "==", userId),
            orderBy("date", "desc")
        );
        const querySnapshot = await getDocs(q);
        const transactions = [];

        for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data();
            const assetRef = docSnap.ref.parent.parent;
            if (assetRef) {
                const assetSnap = await getDoc(assetRef);
                const portfolioRef = assetRef.parent.parent;
                if (assetSnap.exists()) {
                    data.ticker = assetSnap.data().ticker;
                    data.assetId = assetRef.id;
                    data.portfolioId = portfolioRef.id;
                }
            }
            transactions.push({
                id: docSnap.id,
                ...data,
                date: data.date.toDate()
            });
        }
        return transactions;
    } catch (error) {
        console.error("Erro ao buscar todas as transações de investimento:", error);
        if (error.code === 'failed-precondition') {
             throw new Error("O Firestore precisa de um índice para esta consulta. Verifique o console de erros para o link de criação.");
        }
        throw new Error("Não foi possível carregar o histórico de transações.");
    }
}

/**
 * Exclui um movimento e recalcula a posição do ativo.
 * @param {string} portfolioId - ID da carteira.
 * @param {string} assetId - ID do ativo.
 * @param {string} movementId - ID do movimento a ser excluído.
 * @returns {Promise<void>}
 */
export async function deleteMovementAndRecalculate(portfolioId, assetId, movementId) {
    if (!portfolioId || !assetId || !movementId) {
        throw new Error("IDs de carteira, ativo e movimento são necessários para a exclusão.");
    }

    const assetRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId, 'assets', assetId);
    const movementRef = doc(assetRef, 'movements', movementId);

    try {
        await runTransaction(db, async (transaction) => {
            const movementSnap = await transaction.get(movementRef);
            if (!movementSnap.exists()) {
                throw new Error("Movimento não encontrado para exclusão.");
            }
            const movementData = movementSnap.data();

            const assetSnap = await transaction.get(assetRef);

            // Reverte a transação financeira associada (comum a ambos os casos)
            if (movementData.transactionId) {
                const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, movementData.transactionId);
                const financialTxSnap = await transaction.get(transactionRef);

                if (financialTxSnap.exists()) {
                    const financialTx = financialTxSnap.data();
                    const accountRef = doc(db, COLLECTIONS.ACCOUNTS, financialTx.accountId);
                    const amountToRevert = financialTx.type === 'expense' ? financialTx.amount : -financialTx.amount;
                    
                    transaction.update(accountRef, { currentBalance: increment(amountToRevert) });
                    transaction.delete(transactionRef);
                }
            }
            
            // Exclui o documento do movimento (comum a ambos os casos)
            transaction.delete(movementRef);

            // --- LÓGICA CONDICIONAL ---
            if (assetSnap.exists()) {
                // CASO 1: O ATIVO EXISTE -> Recalcula a posição
                const movementsQuery = query(collection(assetRef, 'movements'), orderBy("date", "asc"));
                // Importante: getDocs não pode ser usado dentro de transações.
                // Esta operação agora é feita fora da transação, o que é um compromisso.
                // A alternativa seria ler todos os movimentos individualmente com transaction.get(),
                // o que é muito mais caro e complexo.
                const movementsSnapshot = await getDocs(movementsQuery);
                
                let allMovements = [];
                movementsSnapshot.forEach(doc => {
                    if (doc.id !== movementId) { 
                        allMovements.push(doc.data());
                    }
                });

                let newQuantity = 0;
                let newTotalInvested = 0;
                let newAveragePrice = 0;

                allMovements.forEach(mov => {
                    if (mov.type === 'buy') {
                        newQuantity += mov.quantity;
                        newTotalInvested += mov.totalCost;
                    } else if (mov.type === 'sell') {
                        newTotalInvested -= mov.quantity * (newAveragePrice || 0);
                        newQuantity -= mov.quantity;
                    }
                    newAveragePrice = newQuantity > 0 ? newTotalInvested / newQuantity : 0;
                });

                if (newQuantity <= 0) {
                    newTotalInvested = 0;
                    newAveragePrice = 0;
                }

                transaction.update(assetRef, {
                    quantity: newQuantity,
                    totalInvested: newTotalInvested,
                    averagePrice: newAveragePrice
                });

            } 
            // CASO 2: O ATIVO NÃO EXISTE (ÓRFÃO)
            // A transação financeira e o movimento já foram marcados para exclusão.
            // Não há mais nada a fazer. A transação será concluída.
        });
    } catch (error) {
        console.error("Erro transacional ao excluir e recalcular movimento:", error);
        throw new Error("Falha ao excluir a operação. Verifique os dados e tente novamente.");
    }
}
