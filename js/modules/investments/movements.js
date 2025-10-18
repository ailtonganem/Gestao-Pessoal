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
    where,
    updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// --- INÍCIO DA ALTERAÇÃO ---
/**
 * Busca a conta de investimento associada a uma carteira.
 * @param {string} portfolioId - O ID da carteira.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<object|null>} O documento da conta ou null se não for encontrada.
 */
async function getInvestmentAccountForPortfolio(portfolioId, userId) {
    const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
    const q = query(
        accountsRef,
        where("userId", "==", userId),
        where("portfolioId", "==", portfolioId),
        where("type", "==", "investment")
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
    }
    return null;
}
// --- FIM DA ALTERAÇÃO ---

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
        let finalAccountId = accountId; // Conta a ser usada para a transação financeira

        if (isOwnPortfolio) {
            // --- INÍCIO DA ALTERAÇÃO ---
            if (type === 'sell') {
                const investmentAccount = await getInvestmentAccountForPortfolio(portfolioId, userId);
                if (!investmentAccount) {
                    throw new Error("Conta de investimento para esta carteira não foi encontrada.");
                }
                finalAccountId = investmentAccount.id;
            }
            // --- FIM DA ALTERAÇÃO ---

            if (!finalAccountId) {
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
                accountId: finalAccountId,
                createdAt: serverTimestamp()
            };
            batch.set(newTransactionRef, transactionData);

            const accountRef = doc(db, COLLECTIONS.ACCOUNTS, finalAccountId);
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
 * Adiciona um provento a um ativo, calculando o valor total com base na posição da data.
 * @param {string} portfolioId - O ID da carteira.
 * @param {string} assetId - O ID do ativo.
 * @param {object} proventoData - Dados do provento.
 * @param {number} proventoData.valuePerShare - Valor do provento por cota/ação.
 * @returns {Promise<void>}
 */
export async function addProvento(portfolioId, assetId, proventoData) {
    const batch = writeBatch(db);
    // --- INÍCIO DA ALTERAÇÃO ---
    // O accountId do formulário é removido daqui, pois será determinado automaticamente.
    const { proventoType, paymentDate, valuePerShare, totalAmount, userId } = proventoData;
    // --- FIM DA ALTERAÇÃO ---
    const paymentTimestamp = Timestamp.fromDate(new Date(paymentDate + 'T00:00:00'));

    try {
        const portfolioRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId);
        const assetRef = doc(portfolioRef, 'assets', assetId);
        const movementsRef = collection(assetRef, 'movements');

        const portfolioSnap = await getDoc(portfolioRef);
        if (!portfolioSnap.exists()) throw new Error("Carteira não encontrada.");
        const isOwnPortfolio = portfolioSnap.data().ownershipType === 'own';

        const assetSnap = await getDoc(assetRef);
        if (!assetSnap.exists()) throw new Error("Ativo não encontrado para registrar o provento.");
        const assetTicker = assetSnap.data().ticker;

        const allMovementsQuery = query(movementsRef, where("date", "<=", paymentTimestamp), orderBy("date", "asc"));
        const movementsSnapshot = await getDocs(allMovementsQuery);
        let quantityOnDate = 0;
        movementsSnapshot.forEach(doc => {
            const mov = doc.data();
            if (mov.type === 'buy') quantityOnDate += mov.quantity;
            if (mov.type === 'sell') quantityOnDate -= mov.quantity;
        });

        if (quantityOnDate <= 0 && !totalAmount) { // Se não tem qtde e não foi informado valor total
            throw new Error(`Você não possuía cotas de ${assetTicker} na data ${paymentDate} para receber proventos.`);
        }

        // Se o valor total não foi informado, calcula com base no valor por cota.
        const finalTotalAmount = totalAmount > 0 ? totalAmount : quantityOnDate * valuePerShare;
        let transactionIdForMovement = null;

        const newMovementData = {
            type: 'provento',
            proventoType: proventoType,
            totalAmount: finalTotalAmount,
            valuePerShare: valuePerShare,
            quantityOnDate: quantityOnDate,
            date: paymentTimestamp,
            createdAt: serverTimestamp(),
            userId: userId
        };

        if (isOwnPortfolio) {
            // --- INÍCIO DA ALTERAÇÃO ---
            const investmentAccount = await getInvestmentAccountForPortfolio(portfolioId, userId);
            if (!investmentAccount) {
                throw new Error("Conta de investimento para esta carteira não foi encontrada.");
            }
            const finalAccountId = investmentAccount.id;
            // --- FIM DA ALTERAÇÃO ---

            const newTransactionRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
            transactionIdForMovement = newTransactionRef.id;

            const transactionData = {
                description: `${proventoType} de ${assetTicker}`,
                amount: finalTotalAmount,
                date: paymentTimestamp,
                type: 'revenue',
                category: 'Investimentos',
                subcategory: proventoType,
                paymentMethod: 'credit',
                userId: userId,
                accountId: finalAccountId,
                createdAt: serverTimestamp()
            };
            batch.set(newTransactionRef, transactionData);

            const accountRef = doc(db, COLLECTIONS.ACCOUNTS, finalAccountId);
            batch.update(accountRef, { currentBalance: increment(finalTotalAmount) });
        }
        
        newMovementData.transactionId = transactionIdForMovement;
        const newMovementRef = doc(movementsRef);
        batch.set(newMovementRef, newMovementData);
        
        await batch.commit();

    } catch (error) {
        console.error("Erro ao registrar provento:", error);
        throw error; 
    }
}

/**
 * Busca todos os movimentos do tipo 'provento' de um usuário.
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
            const assetRef = docSnap.ref.parent.parent; // Referência ao documento do ativo
            
            if (assetRef && assetRef.parent && assetRef.parent.parent) {
                const portfolioRef = assetRef.parent.parent; // Referência ao documento da carteira
                
                data.assetId = assetRef.id;
                data.portfolioId = portfolioRef.id;

                const assetSnap = await getDoc(assetRef);
                if (assetSnap.exists()) {
                    data.ticker = assetSnap.data().ticker;
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
    const isOrphan = !portfolioId || !assetId;

    try {
        let movementRef;
        let assetRef;

        if (isOrphan) {
            const movementsGroupRef = collectionGroup(db, 'movements');
            const q = query(movementsGroupRef, where(document.id(), "==", movementId));
            const snapshot = await getDocs(q);
            if (snapshot.empty) throw new Error(`Movimento órfão ${movementId} não encontrado.`);
            movementRef = snapshot.docs[0].ref;
        } else {
            assetRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId, 'assets', assetId);
            movementRef = doc(assetRef, 'movements', movementId);
        }

        await runTransaction(db, async (transaction) => {
            const movementSnap = await transaction.get(movementRef);
            if (!movementSnap.exists()) {
                throw new Error("Movimento não encontrado para exclusão.");
            }
            const movementData = movementSnap.data();

            if (movementData.transactionId) {
                const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, movementData.transactionId);
                const financialTxSnap = await transaction.get(transactionRef);

                if (financialTxSnap.exists()) {
                    const financialTx = financialTxSnap.data();
                    if(financialTx.accountId) {
                        const accountRef = doc(db, COLLECTIONS.ACCOUNTS, financialTx.accountId);
                        const amountToRevert = financialTx.type === 'expense' ? financialTx.amount : -financialTx.amount;
                        transaction.update(accountRef, { currentBalance: increment(amountToRevert) });
                    }
                    transaction.delete(transactionRef);
                }
            }
            
            transaction.delete(movementRef);
        });

        if (!isOrphan) {
            const assetSnap = await getDoc(assetRef);
            if (assetSnap.exists()) {
                const movementsQuery = query(collection(assetRef, 'movements'), orderBy("date", "asc"));
                const movementsSnapshot = await getDocs(movementsQuery);
                
                let allMovements = [];
                movementsSnapshot.forEach(doc => allMovements.push(doc.data()));

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
                    newQuantity = 0;
                }

                await updateDoc(assetRef, {
                    quantity: newQuantity,
                    totalInvested: newTotalInvested,
                    averagePrice: newAveragePrice
                });
            }
        }
    } catch (error) {
        console.error("Erro ao excluir e recalcular movimento:", error);
        throw new Error("Falha ao excluir a operação. Verifique os dados e tente novamente.");
    }
}
