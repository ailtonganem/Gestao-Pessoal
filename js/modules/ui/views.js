// js/modules/ui/views.js

/**
 * Módulo para gerenciar a visibilidade das seções/contêineres principais da aplicação.
 * Controla qual "tela" o usuário está vendo: Carregamento, Autenticação ou o App principal.
 */

// --- Seleção de Elementos do DOM ---
const loadingDiv = document.getElementById('loading');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginSection = document.getElementById('login-form');
const registerSection = document.getElementById('register-form');
const pendingApprovalSection = document.getElementById('pending-approval');

/** Oculta todos os contêineres principais. */
function hideAllViews() {
    loadingDiv.style.display = 'none';
    authContainer.style.display = 'none';
    appContainer.style.display = 'none';
}

/** Exibe a tela de carregamento. */
export function showLoading() {
    hideAllViews();
    loadingDiv.style.display = 'block';
}

/** Exibe a tela principal da aplicação (Dashboard). */
export function showApp() {
    hideAllViews();
    appContainer.style.display = 'block';
}

/** Exibe a tela de autenticação, com o formulário de login visível por padrão. */
export function showAuthForms() {
    hideAllViews();
    authContainer.style.display = 'block';
    loginSection.style.display = 'block';
    registerSection.style.display = 'none';
    pendingApprovalSection.style.display = 'none';
}

/** Exibe a tela de "Aguardando Aprovação". */
export function showPendingApproval() {
    hideAllViews();
    authContainer.style.display = 'block';
    loginSection.style.display = 'none';
    registerSection.style.display = 'none';
    pendingApprovalSection.style.display = 'block';
}

/**
 * Alterna entre os formulários de login e cadastro na tela de autenticação.
 * @param {boolean} showRegister - Se true, exibe o formulário de cadastro; senão, exibe o de login.
 */
export function toggleAuthForms(showRegister) {
    if (showRegister) {
        loginSection.style.display = 'none';
        registerSection.style.display = 'block';
    } else {
        loginSection.style.display = 'block';
        registerSection.style.display = 'none';
    }
}
