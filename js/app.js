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
import * as accounts from './modules/accounts.js';
import { initializeInvestmentsModule } from './modules/investments/main.js';


import { PAGINATION, STORAGE_KEYS } from './config/constants.js';


// --- Ponto de Entrada da Aplicação ---

/**
 * Inicializa a aplicação: define o tema, registra os listeners
 * e começa a monitorar o estado de autenticação do usuário.
 */
function initializeApp() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    toggleTheme(savedTheme === 'dark');
    
    initializeEventListeners();
    initializeInvestmentsModule();
    initializeCollapsibleSections();
    applyDashboardOrder(); 

    views.showLoading();
    auth.monitorAuthState(handleAuthStateChange);
}


// --- Funções de Controle de Autenticação e Dados ---

/**
 * Lida com as mudanças no estado de autenticação do usuário.
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
        state.setCurrentUser(null);
        state.setCurrentUserProfile(null);
        state.setAllTransactions([]);
        state.setFilteredTransactions([]);
        state.setUserCategories([]);
        state.setUserCreditCards([]);
        state.setUserBudgets([]);
        state.setUserRecurringTransactions([]);
        state.setUserAccounts([]);
        state.setLastTransactionDoc(null);
        state.setHasMoreTransactions(true);
        views.showAuthForms();
    }
}

/**
 * Carrega todos os dados iniciais necessários para o dashboard do usuário.
 * @param {string} userId - O ID do usuário logado.
 */
async function loadInitialData(userId) {
    const transactionDateInput = document.getElementById('transaction-date');
    if(transactionDateInput) transactionDateInput.value = new Date().toISOString().split('T')[0];

    const transferDateInput = document.getElementById('transfer-date');
    if(transferDateInput) transferDateInput.value = new Date().toISOString().split('T')[0];

    // Carrega os cartões PRIMEIRO, pois são necessários para processar as recorrências
    await loadUserCreditCards();
    
    const recurringCount = await recurring.processRecurringTransactions(userId, state.userCreditCards);
    if (recurringCount > 0) {
        showNotification(`${recurringCount} transação(ões) recorrente(s) foram lançadas.`);
    }
    await invoices.closeOverdueInvoices(userId);

    render.populateYearFilter();

    await Promise.all([
        loadUserCategories(),
        loadUserAccounts(),
        loadUserBudgets(),
        loadUserDashboard(),
        analytics.getMonthlySummary(userId).then(charts.renderTrendsChart)
    ]);
}


// --- Funções "Controladoras" / Orquestradadoras ---

/** Busca a primeira página de transações, reseta o estado e atualiza o dashboard. */
export async function loadUserDashboard() {
    if (!state.currentUser) return;
    
    state.setLastTransactionDoc(null);
    state.setHasMoreTransactions(true);

    const filters = {
        month: document.getElementById('filter-month').value,
        year: document.getElementById('filter-year').value,
        startDate: document.getElementById('filter-start-date').value,
        endDate: document.getElementById('filter-end-date').value,
        type: document.getElementById('filter-type').value
    };

    try {
        const { transactions: userTransactions, lastVisible } = await transactions.getTransactions(state.currentUser.uid, {
            filters,
            limitNum: PAGINATION.TRANSACTIONS_PER_PAGE,
            lastDoc: null
        });

        state.setAllTransactions(userTransactions);
        state.setLastTransactionDoc(lastVisible);
        state.setHasMoreTransactions(userTransactions.length === PAGINATION.TRANSACTIONS_PER_PAGE);

        applyFiltersAndUpdateDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/**
 * Busca a próxima página de transações e as anexa à lista existente no estado.
 */
export async function loadMoreTransactions() {
    if (!state.currentUser || !state.hasMoreTransactions) return;

    const loadMoreButton = document.getElementById('load-more-button');
    loadMoreButton.disabled = true;
    loadMoreButton.textContent = 'Carregando...';

    const filters = {
        month: document.getElementById('filter-month').value,
        year: document.getElementById('filter-year').value,
        startDate: document.getElementById('filter-start-date').value,
        endDate: document.getElementById('filter-end-date').value,
        type: document.getElementById('filter-type').value
    };

    try {
        const { transactions: newTransactions, lastVisible } = await transactions.getTransactions(state.currentUser.uid, {
            filters,
            limitNum: PAGINATION.TRANSACTIONS_PER_PAGE,
            lastDoc: state.lastTransactionDoc
        });
        
        render.renderTransactionList(newTransactions, true);
        
        state.setAllTransactions([...state.allTransactions, ...newTransactions]);
        state.setLastTransactionDoc(lastVisible);
        state.setHasMoreTransactions(newTransactions.length === PAGINATION.TRANSACTIONS_PER_PAGE);

        applyFiltersAndUpdateDashboard();

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = 'Carregar Mais';
    }
}

/** Busca as categorias, armazena no estado e atualiza os componentes da UI. */
export async function loadUserCategories() {
    if (!state.currentUser) return;
    try {
        const userCategories = await categories.getCategories(state.currentUser.uid);
        state.setUserCategories(userCategories);
        
        render.renderCategoryManagementList();
        render.populateCategoryFilter();
        render.populateBudgetCategorySelect();
        
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

/** Busca as contas, armazena no estado e atualiza a UI. */
export async function loadUserAccounts() {
    if (!state.currentUser) return;
    try {
        const userAccounts = await accounts.getAccounts(state.currentUser.uid);
        state.setUserAccounts(userAccounts);
        render.populateAccountSelects();
        render.renderAccountList();
        render.updateDashboard(); 
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
        render.updateDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/**
 * Aplica os filtros e a ordenação da UI sobre a lista de transações e chama a renderização.
 */
// --- INÍCIO DA ALTERAÇÃO ---
export function applyFiltersAndUpdateDashboard() {
    const descriptionFilter = document.getElementById('filter-description').value.toLowerCase();
    const categoryFilter = document.getElementById('filter-category').value;
    const tagFilter = document.getElementById('filter-tag').value.toLowerCase().trim();
    const typeFilter = document.getElementById('filter-type').value; 
    const sortFilter = document.getElementById('filter-sort').value;
    const paymentMethodFilter = document.getElementById('filter-payment-method').value;

    let filtered = state.allTransactions.filter(transaction => {
        const descriptionMatch = transaction.description.toLowerCase().includes(descriptionFilter);
        const categoryMatch = (categoryFilter === 'all') || (transaction.category === categoryFilter);
        const typeMatch = (typeFilter === 'all') || (transaction.type === typeFilter);
        const paymentMethodMatch = (paymentMethodFilter === 'all') || (transaction.paymentMethod === paymentMethodFilter);
        
        const tagMatch = !tagFilter || (transaction.tags && transaction.tags.some(tag => tag.includes(tagFilter)));

        return descriptionMatch && categoryMatch && typeMatch && paymentMethodMatch && tagMatch;
    });
// --- FIM DA ALTERAÇÃO ---

    switch (sortFilter) {
        case 'date_asc':
            filtered.sort((a, b) => a.date - b.date);
            break;
        case 'amount_desc':
            filtered.sort((a, b) => b.amount - a.amount);
            break;
        case 'amount_asc':
            filtered.sort((a, b) => a.amount - b.amount);
            break;
        case 'date_desc':
        default:
            filtered.sort((a, b) => b.date - a.date);
            break;
    }

    state.setFilteredTransactions(filtered);
    render.renderTransactionList(filtered);
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
        localStorage.setItem(STORAGE_KEYS.THEME, 'dark');
        themeToggle.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem(STORAGE_KEYS.THEME, 'light');
        themeToggle.checked = false;
    }

    if (state.currentUser) {
        charts.renderExpensesChart(state.filteredTransactions);
        analytics.getMonthlySummary(state.currentUser.uid).then(charts.renderTrendsChart);
    }
}

// --- Lógica para seções recolhíveis ---

function getCollapsibleState() {
    try {
        const savedState = localStorage.getItem(STORAGE_KEYS.COLLAPSIBLE_STATE);
        return savedState ? JSON.parse(savedState) : {};
    } catch (e) {
        return {};
    }
}

function saveCollapsibleState(state) {
    localStorage.setItem(STORAGE_KEYS.COLLAPSIBLE_STATE, JSON.stringify(state));
}

export function toggleSection(sectionHeader) {
    const section = sectionHeader.closest('.dashboard-section');
    const sectionId = section.dataset.sectionId;
    const icon = sectionHeader.querySelector('.toggle-icon');
    
    const isExpanded = section.classList.toggle('expanded');
    
    if (isExpanded) {
        icon.innerHTML = '&#9660;';
    } else {
        icon.innerHTML = '&#9658;';
    }

    const currentState = getCollapsibleState();
    currentState[sectionId] = isExpanded;
    saveCollapsibleState(currentState);
}

function initializeCollapsibleSections() {
    const savedState = getCollapsibleState();
    const sections = document.querySelectorAll('.dashboard-section');

    sections.forEach(section => {
        const sectionId = section.dataset.sectionId;
        const header = section.querySelector('.section-header');
        const icon = header.querySelector('.toggle-icon');

        section.classList.remove('expanded');
        icon.innerHTML = '&#9658;';

        if (savedState[sectionId] === true) {
            section.classList.add('expanded');
            icon.innerHTML = '&#9660;';
        }
    });
}

// Lógica para seções reordenáveis

/**
 * Salva a ordem das seções no localStorage.
 * @param {string[]} order - Array com os IDs das seções na nova ordem.
 */
export function saveDashboardOrder(order) {
    localStorage.setItem(STORAGE_KEYS.DASHBOARD_ORDER, JSON.stringify(order));
}

/**
 * Lê a ordem salva do localStorage.
 * @returns {string[]|null} O array com a ordem ou null se não houver.
 */
function getDashboardOrder() {
    try {
        const savedOrder = localStorage.getItem(STORAGE_KEYS.DASHBOARD_ORDER);
        return savedOrder ? JSON.parse(savedOrder) : null;
    } catch (e) {
        return null;
    }
}

/**
 * Aplica a ordem salva às seções do dashboard.
 */
function applyDashboardOrder() {
    const order = getDashboardOrder();
    if (!order) return; 

    const appContent = document.getElementById('app-content');
    const summarySection = document.getElementById('summary-section'); 
    const sections = Array.from(appContent.querySelectorAll('.dashboard-section'));

    const sectionsMap = new Map();
    sections.forEach(section => {
        sectionsMap.set(section.dataset.sectionId, section);
    });

    order.forEach(sectionId => {
        const section = sectionsMap.get(sectionId);
        if (section) {
            appContent.appendChild(section);
        }
    });
}


// --- Inicia a aplicação ---
initializeApp();
