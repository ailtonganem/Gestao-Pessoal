// Importa a instância do Firestore e funções necessárias.
import { db } from '../firebase-config.js';
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Busca a lista de todos os usuários do sistema.
 * (Função que deve ser chamada apenas por um administrador).
 * @returns {Promise<Array<object>>} Uma lista de objetos de usuário.
 */
async function getAllUsers() {
    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const users = [];
        querySnapshot.forEach((doc) => {
            users.push({
                id: doc.id,
                ...doc.data()
            });
        });
        return users;
    } catch (error) {
        console.error("Erro ao buscar todos os usuários:", error);
        throw new Error("Não foi possível carregar a lista de usuários.");
    }
}

/**
 * Atualiza o status de um usuário específico.
 * (Função que deve ser chamada apenas por um administrador).
 * @param {string} uid - O ID do usuário a ser atualizado.
 * @param {string} newStatus - O novo status (ex: 'approved', 'rejected').
 * @returns {Promise<void>}
 */
async function updateUserStatus(uid, newStatus) {
    try {
        const userDocRef = doc(db, "users", uid);
        await updateDoc(userDocRef, {
            status: newStatus
        });
    } catch (error) {
        console.error("Erro ao atualizar status do usuário:", error);
        throw new Error("Não foi possível atualizar o status do usuário.");
    }
}

export { getAllUsers, updateUserStatus };
