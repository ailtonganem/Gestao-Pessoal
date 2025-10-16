// js/modules/state.js

/**
 * Este módulo centraliza o estado global da aplicação.
 * Funciona como a "única fonte da verdade", facilitando o gerenciamento,
 * a depuração e a passagem de dados entre diferentes partes do código.
 */

// --- Estado de Autenticação e Perfil ---
export let currentUser = null;
export let currentUserProfile = null;

// --- Dados Carregados do Firestore ---
export let userCreditCards = [];
export let userCategories = [];
export let userBudgets = [];
export let allTransactions = []; // Contém todas as transações do período selecionado
export let filteredTransactions = []; // Contém as transações após a aplicação de filtros na UI
export let userRecurringTransactions = [];
export let userAccounts = [];
export let userPortfolios = []; // Armazena as carteiras de investimento do usuário


// --- Estado da Interface (UI State) ---
export let selectedCardForInvoiceView = null; // Armazena o objeto do cartão selecionado no modal de faturas
export let currentCardInvoices = []; // Armazena as faturas do cartão que está sendo visualizado
export let expensesChart = null; // Instância do gráfico de despesas (tipo pizza)
export let trendsChart = null; // Instância do gráfico de tendências (tipo barras)
// INÍCIO DA ALTERAÇÃO
export let invoiceSpendingChart = null; // Instância do gráfico de gastos da fatura
// FIM DA ALTERAÇÃO
export let lastTransactionDoc = null; // Armazena o último documento da página de transações
export let hasMoreTransactions = true; // Flag para indicar se há mais transações para carregar
export let selectedPortfolioForAssetsView = null; // Armazena a carteira selecionada para visualização de ativos



// --- Funções "Setters" ---
// Funções para modificar o estado de forma controlada e explícita.
// Em vez de modificar a variável diretamente de qualquer lugar do código,
// chamamos essas funções. Isso torna as atualizações de estado mais fáceis de rastrear.

export function setCurrentUser(user) {
    currentUser = user;
}

export function setCurrentUserProfile(profile) {
    currentUserProfile = profile;
}

export function setUserCreditCards(cards) {
    userCreditCards = cards;
}

export function setUserCategories(categories) {
    userCategories = categories;
}

export function setUserBudgets(budgets) {
    userBudgets = budgets;
}

export function setAllTransactions(transactions) {
    allTransactions = transactions;
}

export function setFilteredTransactions(transactions) {
    filteredTransactions = transactions;
}

export function setUserRecurringTransactions(transactions) {
    userRecurringTransactions = transactions;
}

export function setUserAccounts(accounts) {
    userAccounts = accounts;
}

export function setUserPortfolios(portfolios) {
    userPortfolios = portfolios;
}

export function setLastTransactionDoc(doc) {
    lastTransactionDoc = doc;
}

export function setHasMoreTransactions(value) {
    hasMoreTransactions = value;
}

export function setSelectedCardForInvoiceView(card) {
    selectedCardForInvoiceView = card;
}

export function setSelectedPortfolioForAssetsView(portfolio) {
    selectedPortfolioForAssetsView = portfolio;
}

export function setCurrentCardInvoices(invoices) {
    currentCardInvoices = invoices;
}

export function setExpensesChart(chartInstance) {
    expensesChart = chartInstance;
}

export function setTrendsChart(chartInstance) {
    trendsChart = chartInstance;
}

// INÍCIO DA ALTERAÇÃO
export function setInvoiceSpendingChart(chartInstance) {
    invoiceSpendingChart = chartInstance;
}
// FIM DA ALTERAÇÃO
