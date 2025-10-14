// js/app.js (Refatorado)

// --- Módulos de Estado e UI ---
import * as state from './modules/state.js';
import * as views from './modules/ui/views.js';
import * as render from './modules/ui/render.js';
import * as charts from './modules/ui/charts.js';
import { showNotification } from './modules/ui/notifications.js';
import { initializeEventListeners } from './events.js';

// --- Módulos de Lógica de Negócio (Serviços) ---
import * as auth from './modules/auth.js';
import * as transactions from './modules/transactions.js';
import * as categories from './modules/categories.js';
import * as creditCard from './modules/creditCard.js';
import * as invoices from './modules/invoices.js';
import * as budget from './modules/budget.js';
import * as recurring from './modules/recurring.js';
import * as analytics from './modules/analytics.js';


// --- Ponto de Entrada da Aplicação ---

/**
 * Inicializa a aplicação: define o tema, registra os listeners
 * e começa a monitorar o estado de autenticação do usuário.
 */
function initializeApp() {
    // Define o tema inicial com base no que está salvo no localStorage
    const savedTheme = localStorage.getItem('theme');
    toggleTheme(savedTheme === 'dark');
    
    // Registra todos os event listeners da aplicação
    initializeEventListeners();

    // Inicia o monitoramento do estado de autenticação
    views.showLoading();
    auth.monitorAuthState(handleAuthStateChange);
}


// --- Funções de Controle de Autenticação e Dados ---

/**
 * Lida com as mudanças no estado de autenticação do usuário.
 * É a função principal que direciona o que acontece quando um usuário
 * faz login ou logout.
 * @param {object|null} user - O objeto de usuário do Firebase, ou null se deslogado.
 */
async function handleAuthStateChange(user) {
    if (user) {
        state.setCurrentUser(user);
        try {
            const profile = await auth.getUserProfile(user.uid);
            state.setCurrentUserProfile(profile);

            if (profile && profile.status === 'approved') {
                views.showApp();
                await loadInitialData(user.uid);
            } else {
                views.showPendingApproval();
            }
        } catch (error) {
            showNotification("Erro ao verificar seu perfil. Tente novamente.", "error");
            auth.logoutUser();
        }
    } else {
        // Limpa o estado e exibe a tela de login
        state.setCurrentUser(null);
        state.setCurrentUserProfile(null);
        state.setAllTransactions([]);
        state.setFilteredTransactions([]);
        state.setUserCategories([]);
        state.setUserCreditCards([]);
        state.setUserBudgets([]);
        views.showAuthForms();
    }
}

/**
 * Carrega todos os dados iniciais necessários para o dashboard do usuário.
 * @param {string} userId - O ID do usuário logado.
 */
async function loadInitialData(userId) {
    const transactionDateInput = document.getElementById('transaction-date');
    transactionDateInput.value = new Date().toISOString().split('T')[0];

    // Processa tarefas de fundo
    const recurringCount = await recurring.processRecurringTransactions(userId);
    if (recurringCount > 0) {
        showNotification(`${recurringCount} transação(ões) recorrente(s) foram lançadas.`);
    }
    await invoices.closeOverdueInvoices(userId);

    render.populateYearFilter();

    // Carrega dados em paralelo para agilizar
    await Promise.all([
        loadUserCategories(),
        loadUserCreditCards(),
        loadUserBudgets(),
        loadUserDashboard(),
        analytics.getMonthlySummary(userId).then(charts.renderTrendsChart)
    ]);
}


// --- Funções "Controladoras" / Orquestradoras ---
// Estas funções são exportadas para serem chamadas pelo módulo de eventos.

/** Busca as transações, armazena no estado e atualiza o dashboard. */
export async function loadUserDashboard() {
    if (!state.currentUser) return;
    
    const filters = {
        month: document.getElementById('filter-month').value,
        year: document.getElementById('filter-year').value
    };

    try {
        const userTransactions = await transactions.getTransactions(state.currentUser.uid, filters);
        state.setAllTransactions(userTransactions);
        applyFiltersAndUpdateDashboard(); // Aplica filtros iniciais e renderiza
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/** Busca as categorias, armazena no estado e atualiza os componentes da UI. */
export async function loadUserCategories() {
    if (!state.currentUser) return;
    try {
        const userCategories = await categories.getCategories(state.currentUser.uid);
        state.setUserCategories(userCategories);
        
        // Renderiza todos os locais onde as categorias são usadas
        render.renderCategoryManagementList();
        render.populateCategoryFilter();
        render.populateBudgetCategorySelect();
        
        // Popula os selects dos formulários com base no tipo selecionado
        const transactionType = document.querySelector('input[name="transaction-type"]:checked').value;
        render.populateCategorySelects(transactionType, document.getElementById('transaction-category'));
        const recurringType = document.querySelector('input[name="recurring-type"]:checked').value;
        render.populateCategorySelects(recurringType, document.getElementById('recurring-category'));
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/** Busca os cartões de crédito, armazena no estado e atualiza a UI. */
export async function loadUserCreditCards() {
    if (!state.currentUser) return;
    try {
        const userCards = await creditCard.getCreditCards(state.currentUser.uid);
        state.setUserCreditCards(userCards);
        render.populateCreditCardSelects();
        render.renderCreditCardList();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/** Busca os orçamentos, armazena no estado e atualiza a UI. */
export async function loadUserBudgets() {
    if (!state.currentUser) return;
    try {
        const userBudgets = await budget.getBudgets(state.currentUser.uid);
        state.setUserBudgets(userBudgets);
        render.renderBudgetList();
        render.updateDashboard(); // Atualiza o progresso dos orçamentos
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/**
 * Aplica os filtros da UI sobre a lista de transações e chama a renderização.
 */
export function applyFiltersAndUpdateDashboard() {
    const descriptionFilter = document.getElementById('filter-description').value.toLowerCase();
    const categoryFilter = document.getElementById('filter-category').value;
    const paymentMethodFilter = document.getElementById('filter-payment-method').value;

    const filtered = state.allTransactions.filter(transaction => {
        const descriptionMatch = transaction.description.toLowerCase().includes(descriptionFilter);
        const categoryMatch = (categoryFilter === 'all') || (transaction.category === categoryFilter);
        const paymentMethodMatch = (paymentMethodFilter === 'all') || (transaction.paymentMethod === paymentMethodFilter);
        return descriptionMatch && categoryMatch && paymentMethodMatch;
    });

    state.setFilteredTransactions(filtered);
    render.updateDashboard();
}

/**
 * Alterna entre o tema claro e escuro.
 * @param {boolean} isDarkMode - True para ativar o modo escuro, false para desativar.
 */
export function toggleTheme(isDarkMode) {
    const themeToggle = document.getElementById('theme-toggle');
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
        themeToggle.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
        themeToggle.checked = false;
    }

    // Se houver um usuário logado, recarrega os gráficos para que eles se adaptem ao novo tema
    if (state.currentUser) {
        charts.renderExpensesChart(state.filteredTransactions);
        analytics.getMonthlySummary(state.currentUser.uid).then(charts.renderTrendsChart);
    }
}


// --- Inicia a aplicação ---
initializeApp();
