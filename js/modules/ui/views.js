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

const applicationWrapper = document.getElementById('application-wrapper');
const dashboardContainer = document.getElementById('dashboard-container');
const investmentsContainer = document.getElementById('investments-container');
// INÍCIO DA ALTERAÇÃO
const proventosContainer = document.getElementById('proventos-container');
// FIM DA ALTERAÇÃO
const mainHeaderTitle = document.getElementById('main-header-title');


/** Oculta todos os contêineres principais. */
function hideAllViews() {
    loadingDiv.style.display = 'none';
    authContainer.style.display = 'none';
    applicationWrapper.style.display = 'none';
}

/** Exibe a tela de carregamento. */
export function showLoading() {
    hideAllViews();
    loadingDiv.style.display = 'block';
}

/** Exibe a tela principal da aplicação e, por padrão, a visão do Dashboard. */
export function showApp() {
    hideAllViews();
    applicationWrapper.style.display = 'block';
    showDashboardView(); // Exibe o dashboard por padrão ao logar
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


/** Oculta todas as "páginas" dentro do wrapper principal da aplicação. */
function hideAllAppPages() {
    dashboardContainer.style.display = 'none';
    investmentsContainer.style.display = 'none';
    // INÍCIO DA ALTERAÇÃO
    proventosContainer.style.display = 'none';
    // FIM DA ALTERAÇÃO
}


/**
 * Exibe a "página" do Dashboard.
 */
export function showDashboardView() {
    hideAllAppPages();
    dashboardContainer.style.display = 'block';
    mainHeaderTitle.textContent = 'Dashboard';
}

/**
 * Exibe a "página" de Investimentos.
 */
export function showInvestmentsView() {
    hideAllAppPages();
    investmentsContainer.style.display = 'block';
    mainHeaderTitle.textContent = 'Meus Investimentos';
}

// INÍCIO DA ALTERAÇÃO
/**
 * Exibe a "página" de Proventos.
 */
export function showProventosView() {
    hideAllAppPages();
    proventosContainer.style.display = 'block';
    mainHeaderTitle.textContent = 'Proventos';
}
// FIM DA ALTERAÇÃO
