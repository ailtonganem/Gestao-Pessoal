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
    serverTimestamp
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

        // 1. Preparar o documento do novo movimento
        const newMovementData = {
            type,
            quantity,
            pricePerUnit: price,
            totalCost,
            date: Timestamp.fromDate(new Date(date + 'T00:00:00')),
            createdAt: serverTimestamp()
        };
        const newMovementRef = doc(movementsRef);
        batch.set(newMovementRef, newMovementData);

        // 2. Calcular os novos valores para o ativo
        let newQuantity, newTotalInvested, newAveragePrice;

        if (type === 'buy') {
            newQuantity = currentAsset.quantity + quantity;
            newTotalInvested = currentAsset.totalInvested + totalCost;
            newAveragePrice = newQuantity > 0 ? newTotalInvested / newQuantity : 0;
            
            // 2a. Atualiza o total investido na carteira
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

            // 2b. Atualiza o total investido na carteira
            batch.update(portfolioRef, { totalInvested: increment(-(quantity * currentAsset.averagePrice)) });
        }
        
        // 3. Preparar a atualização do ativo
        const assetUpdateData = {
            quantity: newQuantity,
            totalInvested: newTotalInvested,
            averagePrice: newAveragePrice
        };
        batch.update(assetRef, assetUpdateData);

        // 4. Preparar a criação da transação financeira correspondente
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
        const newTransactionRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
        batch.set(newTransactionRef, transactionData);

        // 5. Atualizar o saldo da conta selecionada
        const accountRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
        const amountToUpdate = transactionType === 'expense' ? -totalCost : totalCost;
        batch.update(accountRef, { currentBalance: increment(amountToUpdate) });
        
        // 6. Executar todas as operações
        await batch.commit();

    } catch (error) {
        console.error("Erro ao registrar movimento:", error);
        // Lança o erro para ser capturado pelo handler
        throw error;
    }
}
