// js/modules/investments/assets.js

/**
 * Módulo para gerenciar a lógica de negócio dos ativos (ações, FIIs, etc.)
 * dentro de uma carteira de investimentos.
 */

import { db } from '../../firebase-config.js';
import { COLLECTIONS } from '../../config/constants.js';
import {
    collection,
    addDoc,
    query,
    getDocs,
    Timestamp,
    orderBy,
    doc,
    deleteDoc,
    updateDoc,
    writeBatch,
    serverTimestamp,
    increment,
    // INÍCIO DA ALTERAÇÃO
    getDoc
    // FIM DA ALTERAÇÃO
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Adiciona um novo ativo a uma carteira específica, incluindo sua primeira operação de compra.
 * @param {string} portfolioId - O ID do documento da carteira pai.
 * @param {object} assetData - Dados do novo ativo (name, ticker, type, etc.).
 * @param {object} purchaseData - Dados da compra inicial (date, quantity, price, accountId, userId).
 * @returns {Promise<void>}
 */
export async function addAssetWithInitialPurchase(portfolioId, assetData, purchaseData) {
    if (!portfolioId) {
        throw new Error("ID da carteira é obrigatório para adicionar um ativo.");
    }
    if (!assetData.ticker) {
        throw new Error("Ticker do ativo é obrigatório.");
    }
    if (purchaseData.quantity <= 0 || purchaseData.price <= 0) {
        throw new Error("Quantidade e preço devem ser valores positivos.");
    }

    const batch = writeBatch(db);

    try {
        // --- INÍCIO DA ALTERAÇÃO ---
        // 1. Busca os dados da carteira para verificar o tipo de propriedade
        const portfolioRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId);
        const portfolioSnap = await getDoc(portfolioRef);
        if (!portfolioSnap.exists()) {
            throw new Error("Carteira não encontrada.");
        }
        const portfolioInfo = portfolioSnap.data();
        const isOwnPortfolio = portfolioInfo.ownershipType === 'own';
        // --- FIM DA ALTERAÇÃO ---

        // 2. Define as referências para os novos documentos
        const assetsRef = collection(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId, 'assets');
        const newAssetRef = doc(assetsRef); // Gera um ID para o novo ativo

        const movementsRef = collection(newAssetRef, 'movements');
        const newMovementRef = doc(movementsRef); // Gera um ID para o primeiro movimento

        const totalCost = purchaseData.quantity * purchaseData.price;
        const purchaseDate = new Date(purchaseData.date + 'T00:00:00');
        let transactionIdForMovement = null;

        // 3. Se a carteira for própria, cria a transação financeira e atualiza o saldo da conta
        if (isOwnPortfolio) {
            if (!purchaseData.accountId) {
                throw new Error("A conta para débito é obrigatória para carteiras próprias.");
            }
            const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
            const newTransactionRef = doc(transactionsRef);
            transactionIdForMovement = newTransactionRef.id;

            const accountRef = doc(db, COLLECTIONS.ACCOUNTS, purchaseData.accountId);
            
            // Dados da transação financeira (despesa)
            const transactionDataToSave = {
                description: `Compra de ${assetData.ticker}`,
                amount: totalCost,
                date: Timestamp.fromDate(purchaseDate),
                type: 'expense',
                category: 'Investimentos',
                paymentMethod: 'debit', // Compra de ativo sempre debita de uma conta
                userId: purchaseData.userId,
                accountId: purchaseData.accountId,
                createdAt: serverTimestamp()
            };
            batch.set(newTransactionRef, transactionDataToSave);

            // Atualiza o saldo da conta
            batch.update(accountRef, { currentBalance: increment(-totalCost) });
        }
        
        // 4. Prepara os dados do ativo e do primeiro movimento (compra)
        const assetDataToSave = {
            ...assetData,
            quantity: purchaseData.quantity,
            averagePrice: purchaseData.price,
            totalInvested: totalCost,
            createdAt: Timestamp.now()
        };
        batch.set(newAssetRef, assetDataToSave);

        const movementDataToSave = {
            type: 'buy',
            quantity: purchaseData.quantity,
            pricePerUnit: purchaseData.price,
            totalCost: totalCost,
            date: Timestamp.fromDate(purchaseDate),
            createdAt: serverTimestamp(),
            transactionId: transactionIdForMovement, // Será null para carteiras de terceiros
            userId: purchaseData.userId // Adiciona userId ao movimento
        };
        batch.set(newMovementRef, movementDataToSave);
        
        // 5. Executa todas as operações de uma vez
        await batch.commit();

    } catch (error) {
        console.error("Erro ao adicionar ativo com compra inicial:", error);
        throw new Error("Não foi possível salvar o novo ativo e sua primeira compra.");
    }
}

/**
 * Busca todos os ativos de uma carteira específica.
 * @param {string} portfolioId - O ID do documento da carteira.
 * @returns {Promise<Array<object>>} Uma lista de objetos de ativo.
 */
export async function getAssets(portfolioId) {
    if (!portfolioId) {
        console.warn("getAssets chamado sem um portfolioId.");
        return [];
    }

    try {
        const assetsRef = collection(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId, 'assets');
        const q = query(assetsRef, orderBy("name"));

        const querySnapshot = await getDocs(q);
        const assets = [];
        querySnapshot.forEach((doc) => {
            assets.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return assets;

    } catch (error) {
        console.error("Erro ao buscar ativos:", error);
        throw new Error("Não foi possível carregar os ativos da carteira.");
    }
}

/**
 * Atualiza os dados de um ativo.
 * @param {string} portfolioId - O ID da carteira pai.
 * @param {string} assetId - O ID do ativo a ser atualizado.
 * @param {object} updatedData - Os novos dados do ativo.
 * @returns {Promise<void>}
 */
export async function updateAsset(portfolioId, assetId, updatedData) {
    if (!portfolioId || !assetId) {
        throw new Error("ID da carteira e do ativo são obrigatórios para a atualização.");
    }
    try {
        const assetDocRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId, 'assets', assetId);
        await updateDoc(assetDocRef, updatedData);
    } catch (error) {
        console.error("Erro ao atualizar ativo:", error);
        throw new Error("Não foi possível salvar as alterações do ativo.");
    }
}

/**
 * Exclui um ativo de uma carteira específica.
 * @param {string} portfolioId - O ID da carteira pai.
 * @param {string} assetId - O ID do ativo a ser excluído.
 * @returns {Promise<void>}
 */
export async function deleteAsset(portfolioId, assetId) {
    if (!portfolioId || !assetId) {
        throw new Error("ID da carteira e do ativo são obrigatórios para a exclusão.");
    }
    try {
        const assetDocRef = doc(db, COLLECTIONS.INVESTMENT_PORTFOLIOS, portfolioId, 'assets', assetId);
        await deleteDoc(assetDocRef);
    } catch (error) {
        console.error("Erro ao excluir ativo:", error);
        throw new Error("Não foi possível excluir o ativo.");
    }
}
