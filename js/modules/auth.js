// Importa a instância de autenticação configurada anteriormente.
import { auth } from '../firebase-config.js';

// Importa as funções específicas de autenticação do SDK do Firebase.
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

/**
 * Tenta cadastrar um novo usuário com e-mail e senha.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object>} O objeto userCredential em caso de sucesso.
 * @throws {Error} Lança o erro original do Firebase em caso de falha.
 */
async function registerUser(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return userCredential;
    } catch (error) {
        console.error("Erro no cadastro:", error.code, error.message);
        // Repassa o erro para ser tratado na camada de UI (app.js)
        throw error;
    }
}

/**
 * Tenta fazer login de um usuário existente com e-mail e senha.
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object>} O objeto userCredential em caso de sucesso.
 * @throws {Error} Lança o erro original do Firebase em caso de falha.
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
 * Monitora o estado de autenticação do usuário em tempo real.
 * Essa função é crucial para SPA, pois determina o que mostrar na tela
 * (login ou dashboard) sempre que o estado muda (login, logout, refresh da página).
 * 
 * @param {function} callback Função a ser executada quando o estado muda. 
 * Recebe o objeto usuário (ou null) como argumento.
 */
function monitorAuthState(callback) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Usuário está logado
            console.log("Estado: Usuário logado", user.uid);
            callback(user);
        } else {
            // Usuário está deslogado
            console.log("Estado: Nenhum usuário logado");
            callback(null);
        }
    });
}

// Exporta as funções para serem utilizadas no arquivo principal da aplicação (app.js).
export { registerUser, loginUser, logoutUser, monitorAuthState };
