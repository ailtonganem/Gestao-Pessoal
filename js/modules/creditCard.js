// js/modules/creditCard.js

// Importa a instância do Firestore que configuramos.
import { db } from '../firebase-config.js';
// INÍCIO DA ALTERAÇÃO - Correção para caminho relativo
import { COLLECTIONS } from '../config/constants.js';
// FIM DA ALTERAÇÃO

// Importa as funções do Firestore necessárias para manipular os dados.
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    doc,
    deleteDoc,
    updateDoc,
    orderBy
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";


/**
 * Adiciona um novo cartão de crédito ao Firestore.
 * @param {object} cardData - Dados do cartão.
 * @param {string} cardData.name - Nome do cartão.
 * @param {number} cardData.closingDay - Dia do fechamento.
 * @param {number} cardData.dueDay - Dia do vencimento.
 * @param {string} cardData.userId - ID do usuário.
 * @returns {Promise<DocumentReference>} A referência do documento criado.
 */
async function addCreditCard(cardData) {
    try {
        const cardsCollectionRef = collection(db, COLLECTIONS.CREDIT_CARDS);
        const docRef = await addDoc(cardsCollectionRef, cardData);
        console.log("Cartão de crédito adicionado com ID:", docRef.id);
        return docRef;
    } catch (error) {
        console.error("Erro ao adicionar cartão de crédito:", error);
        throw new Error("Não foi possível salvar o novo cartão.");
    }
}

/**
 * Busca todos os cartões de crédito de um usuário específico.
 * @param {string} userId - O ID do usuário.
 * @returns {Promise<Array>} Uma lista de objetos de cartão de crédito.
 */
async function getCreditCards(userId) {
    try {
        const cardsCollectionRef = collection(db, COLLECTIONS.CREDIT_CARDS);
        const q = query(
            cardsCollectionRef,
            where("userId", "==", userId),
            orderBy("name") // Ordena por nome para manter a lista consistente
        );
        const querySnapshot = await getDocs(q);
        const cards = [];
        querySnapshot.forEach((doc) => {
            cards.push({
                id: doc.id,
                ...doc.data()
            });
        });
        return cards;
    } catch (error) {
        console.error("Erro ao buscar cartões de crédito:", error);
        throw new Error("Não foi possível carregar os cartões.");
    }
}

/**
 * Exclui um cartão de crédito do Firestore.
 * @param {string} cardId - O ID do documento do cartão a ser excluído.
 * @returns {Promise<void>}
 */
async function deleteCreditCard(cardId) {
    try {
        const cardDocRef = doc(db, COLLECTIONS.CREDIT_CARDS, cardId);
        await deleteDoc(cardDocRef);
        console.log(`Cartão com ID ${cardId} foi excluído.`);
    } catch (error) {
        console.error("Erro ao excluir cartão de crédito:", error);
        throw new Error("Não foi possível excluir o cartão.");
    }
}

/**
 * (Função Placeholder para o Futuro) Atualiza um cartão de crédito.
 * @param {string} cardId - O ID do documento a ser atualizado.
 * @param {object} updatedData - Os novos dados para o cartão.
 * @returns {Promise<void>}
 */
async function updateCreditCard(cardId, updatedData) {
    try {
        const cardDocRef = doc(db, COLLECTIONS.CREDIT_CARDS, cardId);
        await updateDoc(cardDocRef, updatedData);
        console.log(`Cartão com ID ${cardId} foi atualizado.`);
    } catch (error) {
        console.error("Erro ao atualizar cartão de crédito:", error);
        throw new Error("Não foi possível salvar as alterações do cartão.");
    }
}

// Exporta as funções para serem utilizadas em outros módulos.
export { addCreditCard, getCreditCards, deleteCreditCard, updateCreditCard };
