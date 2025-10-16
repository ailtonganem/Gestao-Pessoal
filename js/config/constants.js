// js/config/constants.js

/**
 * Módulo para centralizar todas as constantes da aplicação.
 * Isso inclui nomes de coleções do Firestore, chaves do localStorage
 * e outras configurações fixas para evitar "magic strings" no código.
 */

// Nomes das coleções do Firestore
export const COLLECTIONS = {
    USERS: 'users',
    TRANSACTIONS: 'transactions',
    CATEGORIES: 'categories',
    ACCOUNTS: 'accounts',
    CREDIT_CARDS: 'creditCards',
    INVOICES: 'invoices',
    INVOICE_TRANSACTIONS: 'transactions', // Subcoleção dentro de invoices
    BUDGETS: 'budgets',
    RECURRING_TRANSACTIONS: 'recurringTransactions',
    DESCRIPTIONS: 'descriptions', // Subcoleção dentro de users
    // INÍCIO DA ALTERAÇÃO
    INVESTMENT_PORTFOLIOS: 'investment_portfolios'
    // FIM DA ALTERAÇÃO
};

// Chaves usadas no Local Storage
export const STORAGE_KEYS = {
    THEME: 'theme',
    COLLAPSIBLE_STATE: 'dashboardCollapsibleState',
    DASHBOARD_ORDER: 'dashboardSectionOrder'
};

// Configurações de Paginação
export const PAGINATION = {
    TRANSACTIONS_PER_PAGE: 25
};
