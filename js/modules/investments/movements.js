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
    // INÍCIO DA ALTERAÇÃO
    deleteDoc,
    runTransaction
    // FIM DA ALTERAÇÃO
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

        const assetSnap = await getDoc(assetRef);
        if (!assetSnap.exists()) {
            throw new Error("Ativo não encontrado para registrar a operação.");
        }
        const currentAsset = assetSnap.data();

        const { type, quantity, price, date, accountId } = movementData;
        const totalCost = quantity * price;

        const newTransactionRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
        
        const newMovementData = {
            type,
            quantity,
            pricePerUnit: price,
            totalCost,
            date: Timestamp.fromDate(new Date(date + 'T00:00:00')),
            createdAt: serverTimestamp(),
            transactionId: newTransactionRef.id 
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

        const transactionType = type === 'buy' ? 'expense' : 'revenue';
        const transactionDescription = type === 'buy' ? `Compra de ${currentAsset.ticker}` : `Venda de ${currentAsset.ticker}`;
        
        const transactionData = {
            description: transactionDescription,
            amount: totalCost,
            date: Timestamp.fromDate(new Date(date + 'T00:00:00')),
            type: transactionType,
            category: "Investimentos",
            paymentMethod: 'debit',
            userId: movementData.userId,
            accountId: accountId,
            createdAt: serverTimestamp()
        };
        batch.set(newTransactionRef, transactionData);

        const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
        const amountToUpdate = transactionType === 'expense' ? -totalCost : totalCost;
        batch.update(accountRef, { currentBalance: increment(amountToUpdate) });
        
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
        const assetRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId, 'assets', assetId);
        const movementsRef = collection(assetRef, 'movements');

        const assetSnap = await getDoc(assetRef);
        if (!assetSnap.exists()) {
            throw new Error("Ativo não encontrado para registrar o provento.");
        }
        const currentAsset = assetSnap.data();

        const { proventoType, paymentDate, totalAmount, accountId, userId } = proventoData;

        const newTransactionRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));

        const newMovementData = {
            type: 'provento',
            proventoType: proventoType,
            totalAmount: totalAmount,
            date: Timestamp.fromDate(new Date(paymentDate + 'T00:00:00')),
            createdAt: serverTimestamp(),
            transactionId: newTransactionRef.id
        };
        const newMovementRef = doc(movementsRef);
        batch.set(newMovementRef, newMovementData);

        const transactionData = {
            description: `${proventoType} de ${currentAsset.ticker}`,
            amount: totalAmount,
            date: Timestamp.fromDate(new Date(paymentDate + 'T00:00:00')),
            type: 'revenue',
            category: 'Dividendos',
            paymentMethod: 'credit',
            userId: userId,
            accountId: accountId,
            createdAt: serverTimestamp()
        };
        batch.set(newTransactionRef, transactionData);

        const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
        batch.update(accountRef, { currentBalance: increment(totalAmount) });
        
        await batch.commit();

    } catch (error) {
        console.error("Erro ao registrar provento:", error);
        throw new Error("Não foi possível salvar o registro do provento.");
    }
}

// INÍCIO DA ALTERAÇÃO
/**
 * Exclui um movimento e recalcula a posição do ativo.
 * @param {string} portfolioId - ID da carteira.
 * @param {string} assetId - ID do ativo.
 * @param {string} movementId - ID do movimento a ser excluído.
 * @returns {Promise<void>}
 */
export async function deleteMovementAndRecalculate(portfolioId, assetId, movementId) {
    const assetRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId, 'assets', assetId);
    const movementRef = doc(assetRef, 'movements', movementId);

    try {
        await runTransaction(db, async (transaction) => {
            // 1. Obter os dados do movimento a ser excluído
            const movementSnap = await transaction.get(movementRef);
            if (!movementSnap.exists()) {
                throw new Error("Movimento não encontrado para exclusão.");
            }
            const movementData = movementSnap.data();
            
            // 2. Reverter a transação financeira associada
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
            
            // 3. Excluir o documento do movimento
            transaction.delete(movementRef);

            // 4. Buscar TODOS os outros movimentos do ativo
            const movementsQuery = query(collection(assetRef, 'movements'), orderBy("date", "asc"));
            const movementsSnapshot = await getDocs(movementsQuery); // Precisa ser fora da transação
            
            let allMovements = [];
            movementsSnapshot.forEach(doc => {
                if (doc.id !== movementId) { // Garante que o movimento excluído não entre no recálculo
                    allMovements.push(doc.data());
                }
            });

            // 5. Recalcular a posição do ativo do zero
            let newQuantity = 0;
            let newTotalInvested = 0;
            let newAveragePrice = 0;

            allMovements.forEach(mov => {
                if (mov.type === 'buy') {
                    newQuantity += mov.quantity;
                    newTotalInvested += mov.totalCost;
                } else if (mov.type === 'sell') {
                    newTotalInvested -= mov.quantity * newAveragePrice; // Abate o custo pelo preço médio daquele momento
                    newQuantity -= mov.quantity;
                }
                newAveragePrice = newQuantity > 0 ? newTotalInvested / newQuantity : 0;
            });

            if (newQuantity <= 0) {
                newTotalInvested = 0;
                newAveragePrice = 0;
            }

            // 6. Atualizar o documento do ativo com os valores recalculados
            transaction.update(assetRef, {
                quantity: newQuantity,
                totalInvested: newTotalInvested,
                averagePrice: newAveragePrice
            });
        });
    } catch (error) {
        console.error("Erro transacional ao excluir e recalcular movimento:", error);
        throw new Error("Falha ao excluir a operação. Tente novamente.");
    }
}
// FIM DA ALTERAÇÃO
