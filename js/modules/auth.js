// js/modules/auth.js

// Importa a instância de autenticação e o banco de dados.
import { auth, db } from '../firebase-config.js';
// INÍCIO DA ALTERAÇÃO - Importa as constantes de coleções
import { COLLECTIONS } from '../config/constants.js';
// FIM DA ALTERAÇÃO

// Importa as funções específicas de autenticação do SDK do Firebase.
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

// Importa funções do Firestore para gerenciar perfis de usuário
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Importa a função para criar categorias padrão.
import { createDefaultCategoriesForUser } from './categories.js';

/**
 * Tenta cadastrar um novo usuário.
 * Cria o usuário no Firebase Auth e um perfil de usuário no Firestore com status 'pending'.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object>} O objeto userCredential em caso de sucesso.
 */
async function registerUser(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (user) {
            // Cria um documento de perfil para o novo usuário no Firestore.
            // INÍCIO DA ALTERAÇÃO
            const userProfileRef = doc(db, COLLECTIONS.USERS, user.uid);
            // FIM DA ALTERAÇÃO
            await setDoc(userProfileRef, {
                email: user.email,
                status: "pending", // Status inicial
                createdAt: new Date()
            });

            // Cria as categorias padrão para o novo usuário.
            await createDefaultCategoriesForUser(user.uid);
        }

        return userCredential;
    } catch (error) {
        console.error("Erro no cadastro:", error.code, error.message);
        throw error;
    }
}

/**
 * Tenta fazer login de um usuário existente com e-mail e senha.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object>} O objeto userCredential em caso de sucesso.
 */
async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential;
    } catch (error) {
        console.error("Erro no login:", error.code, error.message);
        throw error;
    }
}

/**
 * Desconecta o usuário atual.
 * @returns {Promise<void>}
 */
async function logoutUser() {
    try {
        await signOut(auth);
        console.log("Usuário desconectado.");
    } catch (error) {
        console.error("Erro ao sair:", error);
        throw error;
    }
}

/**
 * Busca o perfil de um usuário no Firestore para verificar seu status.
 * @param {string} uid - O ID do usuário.
 * @returns {Promise<object|null>} O objeto com os dados do perfil ou null se não encontrado.
 */
async function getUserProfile(uid) {
    try {
        // INÍCIO DA ALTERAÇÃO
        const userProfileRef = doc(db, COLLECTIONS.USERS, uid);
        // FIM DA ALTERAÇÃO
        const docSnap = await getDoc(userProfileRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            // Isso não deveria acontecer para um usuário logado, mas é uma boa prática de segurança.
            console.log("Perfil de usuário não encontrado no Firestore!");
            return null;
        }
    } catch (error) {
        console.error("Erro ao buscar perfil do usuário:", error);
        throw error;
    }
}

/**
 * Envia um e-mail para redefinição de senha para o endereço fornecido.
 * @param {string} email O e-mail do usuário.
 * @returns {Promise<void>}
 */
async function sendPasswordReset(email) {
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error) {
        console.error("Erro ao enviar e-mail de redefinição de senha:", error);
        throw error;
    }
}

/**
 * Monitora o estado de autenticação do usuário em tempo real.
 * @param {function} callback Função a ser executada quando o estado muda. 
 */
function monitorAuthState(callback) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Estado: Usuário logado", user.uid);
            callback(user);
        } else {
            console.log("Estado: Nenhum usuário logado");
            callback(null);
        }
    });
}

// Exporta as funções para serem utilizadas no arquivo principal da aplicação (app.js).
export { registerUser, loginUser, logoutUser, monitorAuthState, getUserProfile, sendPasswordReset };
