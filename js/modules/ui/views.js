// js/modules/ui/views.js

/**
 * Módulo para gerenciar a visibilidade das seções/contêineres principais da aplicação.
 * Controla qual "tela" o usuário está vendo: Carregamento, Autenticação, Dashboard ou Investimentos.
 */

// --- Seleção de Elementos do DOM ---
const loadingDiv = document.getElementById('loading');
const authContainer = document.getElementById('auth-container');
const loginSection = document.getElementById('login-form');
const registerSection = document.getElementById('register-form');
const pendingApprovalSection = document.getElementById('pending-approval');

// INÍCIO DA ALTERAÇÃO - Novos seletores para a arquitetura de "páginas"
const applicationWrapper = document.getElementById('application-wrapper');
const dashboardContainer = document.getElementById('dashboard-container');
const investmentsContainer = document.getElementById('investments-container');
const mainHeaderTitle = document.getElementById('main-header-title');
// FIM DA ALTERAÇÃO


/** Oculta todos os contêineres principais. */
function hideAllViews() {
    loadingDiv.style.display = 'none';
    authContainer.style.display = 'none';
    // INÍCIO DA ALTERAÇÃO
    applicationWrapper.style.display = 'none';
    // FIM DA ALTERAÇÃO
}

/** Exibe a tela de carregamento. */
export function showLoading() {
    hideAllViews();
    loadingDiv.style.display = 'block';
}

/** Exibe a tela principal da aplicação e, por padrão, a visão do Dashboard. */
export function showApp() {
    hideAllViews();
    // INÍCIO DA ALTERAÇÃO
    applicationWrapper.style.display = 'block';
    showDashboardView(); // Exibe o dashboard por padrão ao logar
    // FIM DA ALTERAÇÃO
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

// INÍCIO DA ALTERAÇÃO - Novas funções para controlar a navegação entre "páginas"

/**
 * Exibe a "página" do Dashboard.
 */
export function showDashboardView() {
    investmentsContainer.style.display = 'none';
    dashboardContainer.style.display = 'block';
    mainHeaderTitle.textContent = 'Dashboard';
}

/**
 * Exibe a "página" de Investimentos.
 */
export function showInvestmentsView() {
    dashboardContainer.style.display = 'none';
    investmentsContainer.style.display = 'block';
    mainHeaderTitle.textContent = 'Meus Investimentos';
}
// FIM DA ALTERAÇÃO
