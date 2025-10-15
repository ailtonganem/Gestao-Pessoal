// js/modules/autocomplete.js

/**
 * Módulo para gerenciar a lógica de autocomplete de descrições.
 * Inclui salvar novas descrições únicas e buscar sugestões.
 */

import { db } from '../firebase-config.js';
// INÍCIO DA ALTERAÇÃO - Importa as constantes de coleções
import { COLLECTIONS } from '../config/constants.js';
// FIM DA ALTERAÇÃO
import {
    doc,
    setDoc,
    collection,
    query,
    where,
    limit,
    getDocs,
    documentId // Importa documentId para a consulta
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";


/**
 * Salva uma nova descrição de transação na subcoleção de descrições únicas do usuário.
 * Usa o próprio texto da descrição (em minúsculas e normalizado) como ID do documento
 * para garantir que não haja duplicatas.
 * @param {string} userId - O ID do usuário.
 * @param {string} description - O texto da descrição a ser salvo.
 * @returns {Promise<void>}
 */
export async function saveUniqueDescription(userId, description) {
    if (!userId || !description || description.trim().length < 3) {
        return; // Não salva descrições vazias ou muito curtas
    }

    const normalizedDescription = description.trim().toLowerCase();
    // O ID do documento será a própria descrição normalizada para evitar duplicatas.
    // INÍCIO DA ALTERAÇÃO
    const descriptionDocRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.DESCRIPTIONS, normalizedDescription);
    // FIM DA ALTERAÇÃO

    try {
        // setDoc com merge:true é uma forma eficiente de "criar se não existe"
        await setDoc(descriptionDocRef, {
            text: description.trim() // Salva o texto original com maiúsculas/minúsculas
        }, { merge: true });
    } catch (error) {
        // Erros aqui não são críticos para o usuário, então apenas registramos no console.
        console.error("Erro ao salvar descrição para autocomplete:", error);
    }
}

/**
 * Busca sugestões de descrição que começam com o termo pesquisado.
 * @param {string} userId - O ID do usuário.
 * @param {string} searchTerm - O texto que o usuário está digitando.
 * @returns {Promise<Array<string>>} Uma lista de até 5 sugestões de descrição.
 */
export async function getDescriptionSuggestions(userId, searchTerm) {
    if (!userId || !searchTerm || searchTerm.trim().length < 2) {
        return []; // Retorna vazio se a busca for muito curta
    }

    const normalizedSearchTerm = searchTerm.toLowerCase();
    // INÍCIO DA ALTERAÇÃO
    const descriptionsRef = collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.DESCRIPTIONS);
    // FIM DA ALTERAÇÃO
    
    // Cria uma consulta que busca documentos cujo ID (descrição normalizada)
    // começa com o termo pesquisado.
    const q = query(
        descriptionsRef,
        where(documentId(), '>=', normalizedSearchTerm),
        where(documentId(), '<=', normalizedSearchTerm + '\uf8ff'),
        limit(5)
    );

    try {
        const querySnapshot = await getDocs(q);
        const suggestions = [];
        querySnapshot.forEach((doc) => {
            // Retorna o texto original salvo, não o ID normalizado
            suggestions.push(doc.data().text);
        });
        return suggestions;
    } catch (error) {
        console.error("Erro ao buscar sugestões:", error);
        return [];
    }
}
