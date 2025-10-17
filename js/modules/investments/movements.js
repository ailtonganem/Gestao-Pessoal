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
    orderBy
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

        // INÍCIO DA ALTERAÇÃO
        // 1. Preparar a criação da transação financeira para obter seu ID
        const newTransactionRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
        
        // 2. Preparar o documento do novo movimento, incluindo o ID da transação
        const newMovementData = {
            type,
            quantity,
            pricePerUnit: price,
            totalCost,
            date: Timestamp.fromDate(new Date(date + 'T00:00:00')),
            createdAt: serverTimestamp(),
            transactionId: newTransactionRef.id // Vínculo com a transação financeira
        };
        const newMovementRef = doc(movementsRef);
        batch.set(newMovementRef, newMovementData);
        // FIM DA ALTERAÇÃO

        // 3. Calcular os novos valores para o ativo
        let newQuantity, newTotalInvested, newAveragePrice;

        if (type === 'buy') {
            newQuantity = currentAsset.quantity + quantity;
            newTotalInvested = currentAsset.totalInvested + totalCost;
            newAveragePrice = newQuantity > 0 ? newTotalInvested / newQuantity : 0;
            
            // 3a. Atualiza o total investido na carteira
            batch.update(portfolioRef, { totalInvested: increment(totalCost) });

        } else { // 'sell'
            if (quantity > currentAsset.quantity) {
                throw new Error("Não é possível vender mais ativos do que você possui.");
            }
            newQuantity = currentAsset.quantity - quantity;
            // Reduz o custo total proporcionalmente ao preço médio
            newTotalInvested = currentAsset.totalInvested - (quantity * currentAsset.averagePrice);
            newAveragePrice = currentAsset.averagePrice; // Preço médio não muda na venda
            if (newQuantity === 0) { // Se vendeu tudo, zera o custo para evitar resíduos
                newTotalInvested = 0;
                newAveragePrice = 0;
            }

            // 3b. Atualiza o total investido na carteira
            batch.update(portfolioRef, { totalInvested: increment(-(quantity * currentAsset.averagePrice)) });
        }
        
        // 4. Preparar a atualização do ativo
        const assetUpdateData = {
            quantity: newQuantity,
            totalInvested: newTotalInvested,
            averagePrice: newAveragePrice
        };
        batch.update(assetRef, assetUpdateData);

        // 5. Preparar os dados da transação financeira correspondente
        const transactionType = type === 'buy' ? 'expense' : 'revenue';
        const transactionDescription = type === 'buy' ? `Compra de ${currentAsset.ticker}` : `Venda de ${currentAsset.ticker}`;
        
        const transactionData = {
            description: transactionDescription,
            amount: totalCost,
            date: Timestamp.fromDate(new Date(date + 'T00:00:00')),
            type: transactionType,
            category: "Investimentos",
            paymentMethod: 'debit', // Assume que saiu/entrou da conta
            userId: movementData.userId,
            accountId: accountId,
            createdAt: serverTimestamp()
        };
        batch.set(newTransactionRef, transactionData);

        // 6. Atualizar o saldo da conta selecionada
        const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
        const amountToUpdate = transactionType === 'expense' ? -totalCost : totalCost;
        batch.update(accountRef, { currentBalance: increment(amountToUpdate) });
        
        // 7. Executar todas as operações
        await batch.commit();

    } catch (error) {
        console.error("Erro ao registrar movimento:", error);
        // Lança o erro para ser capturado pelo handler
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
                date: data.date.toDate() // Converte Timestamp para objeto Date do JS
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

        // INÍCIO DA ALTERAÇÃO
        // 1. Preparar a transação de receita para obter seu ID
        const newTransactionRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));

        // 2. Registra o provento como um tipo de 'movimento', incluindo o ID da transação
        const newMovementData = {
            type: 'provento',
            proventoType: proventoType,
            totalAmount: totalAmount,
            date: Timestamp.fromDate(new Date(paymentDate + 'T00:00:00')),
            createdAt: serverTimestamp(),
            transactionId: newTransactionRef.id // Vínculo com a transação financeira
        };
        const newMovementRef = doc(movementsRef);
        batch.set(newMovementRef, newMovementData);
        // FIM DA ALTERAÇÃO

        // 3. Prepara os dados da transação de receita correspondente
        const transactionData = {
            description: `${proventoType} de ${currentAsset.ticker}`,
            amount: totalAmount,
            date: Timestamp.fromDate(new Date(paymentDate + 'T00:00:00')),
            type: 'revenue',
            category: 'Dividendos', // Categoria genérica para todos os proventos
            paymentMethod: 'credit', // Representa uma entrada de dinheiro
            userId: userId,
            accountId: accountId,
            createdAt: serverTimestamp()
        };
        batch.set(newTransactionRef, transactionData);

        // 4. Atualiza o saldo da conta de destino
        const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
        batch.update(accountRef, { currentBalance: increment(totalAmount) });
        
        // 5. Executa todas as operações
        await batch.commit();

    } catch (error) {
        console.error("Erro ao registrar provento:", error);
        throw new Error("Não foi possível salvar o registro do provento.");
    }
}
