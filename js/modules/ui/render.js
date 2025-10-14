// js/modules/ui/render.js

/**
 * Módulo responsável por toda a renderização do DOM.
 * Ele lê dados do módulo de estado e os transforma em HTML,
 * atualizando a interface do usuário.
 */

import * as state from '../state.js';
import * as modals from './modals.js';
import * as charts from './charts.js';
import { formatCurrency } from './utils.js';
import { showNotification } from './notifications.js';

// --- Seleção de Elementos do DOM ---
const totalRevenueEl = document.getElementById('total-revenue');
const totalExpensesEl = document.getElementById('total-expenses');
const finalBalanceEl = document.getElementById('final-balance');
const transactionsListEl = document.getElementById('transactions-list');
const creditCardSelect = document.getElementById('credit-card-select');
const editCreditCardSelect = document.getElementById('edit-credit-card-select');
const creditCardList = document.getElementById('credit-card-list');
const filterYearSelect = document.getElementById('filter-year');
const filterCategorySelect = document.getElementById('filter-category');
const revenueCategoriesList = document.getElementById('revenue-categories-list');
const expenseCategoriesList = document.getElementById('expense-categories-list');
const userList = document.getElementById('user-list');
const recurringList = document.getElementById('recurring-list');
const budgetCategorySelect = document.getElementById('budget-category');
const budgetList = document.getElementById('budget-list');
const budgetProgressList = document.getElementById('budget-progress-list');

// Elementos do Modal de Faturas
const invoiceTotalAmount = document.getElementById('invoice-total-amount');
const invoiceDueDate = document.getElementById('invoice-due-date');
const invoiceStatus = document.getElementById('invoice-status');
const invoiceTransactionsList = document.getElementById('invoice-transactions-list');
const invoicePeriodSelect = document.getElementById('invoice-period-select');


// --- Funções de Renderização do Dashboard Principal ---

/** Renderiza o dashboard: calcula totais, exibe a lista, e atualiza gráficos e orçamentos. */
export function updateDashboard() {
    let fullPeriodRevenue = 0;
    let fullPeriodExpenses = 0;
    state.allTransactions.forEach(t => {
        if (t.type === 'revenue') fullPeriodRevenue += t.amount;
        else fullPeriodExpenses += t.amount;
    });

    totalRevenueEl.textContent = formatCurrency(fullPeriodRevenue);
    totalExpensesEl.textContent = formatCurrency(fullPeriodExpenses);
    finalBalanceEl.textContent = formatCurrency(fullPeriodRevenue - fullPeriodExpenses);

    renderTransactionList(state.filteredTransactions);
    charts.renderExpensesChart(state.filteredTransactions);
    renderBudgetProgress();
}

/**
 * Renderiza a lista de transações na tela.
 * @param {Array<object>} transactionsToRender - A lista de transações a ser exibida.
 */
function renderTransactionList(transactionsToRender) {
    transactionsListEl.innerHTML = '';
    if (transactionsToRender.length === 0) {
        transactionsListEl.innerHTML = '<li>Nenhuma transação encontrada para os filtros aplicados.</li>';
        return;
    }

    transactionsToRender.forEach(transaction => {
        const li = document.createElement('li');
        li.classList.add(transaction.type);
        li.dataset.id = transaction.id;

        const formattedDate = transaction.date.toLocaleDateString('pt-BR');
        const categoryDisplay = transaction.subcategory 
            ? `${transaction.category} / ${transaction.subcategory}` 
            : transaction.category;

        li.innerHTML = `
            <div style="text-align: left;">
                <span class="transaction-description">${transaction.description}</span>
                <span style="display: block; font-size: 0.8rem; color: #7f8c8d;">
                    ${formattedDate} • ${categoryDisplay || ''} • ${transaction.paymentMethod || ''}
                </span>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <span class="transaction-amount">${formatCurrency(transaction.amount)}</span>
                <div class="transaction-actions">
                    <button class="action-btn edit-btn" title="Editar">&#9998;</button>
                    <button class="action-btn delete-btn" title="Excluir">&times;</button>
                </div>
            </div>
        `;
        transactionsListEl.appendChild(li);
    });
}


// --- Funções de Renderização para Formulários e Selects ---

/** Popula um elemento <select> com as categorias do usuário. */
export function populateCategorySelects(type, selectElement) {
    const filteredCategories = state.userCategories.filter(cat => cat.type === type);
    selectElement.innerHTML = '';

    if (filteredCategories.length === 0) {
        selectElement.innerHTML = `<option disabled>Nenhuma categoria de ${type === 'revenue' ? 'receita' : 'despesa'}</option>`;
        return;
    }
    filteredCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.dataset.categoryId = category.id;
        option.textContent = category.name;
        selectElement.appendChild(option);
    });
}

/** Popula os <select> de cartão de crédito com os cartões do usuário. */
export function populateCreditCardSelects() {
    creditCardSelect.innerHTML = '';
    editCreditCardSelect.innerHTML = '';

    if (state.userCreditCards.length === 0) {
        const option = '<option disabled>Nenhum cartão cadastrado</option>';
        creditCardSelect.innerHTML = option;
        editCreditCardSelect.innerHTML = option;
    } else {
        state.userCreditCards.forEach(card => {
            const option = document.createElement('option');
            option.value = card.id;
            option.textContent = card.name;
            creditCardSelect.appendChild(option.cloneNode(true));
            editCreditCardSelect.appendChild(option.cloneNode(true));
        });
    }
}

/** Popula o dropdown de anos no filtro. */
export function populateYearFilter() {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5;
    filterYearSelect.innerHTML = '';
    for (let year = currentYear; year >= startYear; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        filterYearSelect.appendChild(option);
    }
}

/** Popula o dropdown de categorias no filtro. */
export function populateCategoryFilter() {
    filterCategorySelect.innerHTML = '<option value="all">Todas</option>';
    state.userCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        filterCategorySelect.appendChild(option);
    });
}


// --- Funções de Renderização para Modais ---

/** Renderiza a lista de cartões de crédito no modal. */
export function renderCreditCardList() {
    creditCardList.innerHTML = '';
    if (state.userCreditCards.length === 0) {
        creditCardList.innerHTML = '<li>Nenhum cartão cadastrado.</li>';
    } else {
        state.userCreditCards.forEach(card => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="card-info" data-card-id="${card.id}" style="flex-grow: 1; cursor: pointer;">
                    ${card.name} (Fecha dia ${card.closingDay}, Vence dia ${card.dueDay})
                </div>
                <button class="action-btn delete-btn" data-card-id="${card.id}" title="Excluir cartão">&times;</button>
            `;
            creditCardList.appendChild(li);
        });
    }
}

/** Renderiza o conteúdo da tela de faturas quando não há faturas. */
export function renderEmptyInvoiceDetails() {
    invoicePeriodSelect.innerHTML = '<option>Nenhuma fatura encontrada</option>';
    invoiceTotalAmount.textContent = formatCurrency(0);
    invoiceDueDate.textContent = '--/--/----';
    invoiceStatus.textContent = '--';
    invoiceStatus.className = 'status-badge';
    invoiceTransactionsList.innerHTML = '<li>Nenhum lançamento.</li>';
}

/** Popula o select de períodos da fatura. */
export function renderInvoicePeriodSelect(invoices) {
    invoicePeriodSelect.innerHTML = '';
    invoices.forEach(invoice => {
        const option = document.createElement('option');
        option.value = invoice.id;
        option.textContent = `${invoice.month.toString().padStart(2, '0')}/${invoice.year} (${invoice.status})`;
        invoicePeriodSelect.appendChild(option);
    });
}

/** Renderiza o resumo da fatura (total, vencimento, status). */
export function renderInvoiceSummary(invoice) {
    invoiceTotalAmount.textContent = formatCurrency(invoice.totalAmount);
    invoiceDueDate.textContent = invoice.dueDate.toLocaleDateString('pt-BR');
    invoiceStatus.textContent = invoice.status;
    invoiceStatus.className = 'status-badge';
    invoiceStatus.classList.add(invoice.status);
}

/** Renderiza a lista de lançamentos de uma fatura, incluindo botões de ação. */
export function renderInvoiceTransactionsList(transactions) {
    invoiceTransactionsList.innerHTML = '';
    if (transactions.length === 0 || !transactions[0].description) {
        invoiceTransactionsList.innerHTML = '<li>Nenhum lançamento nesta fatura.</li>';
        return;
    }
    transactions.forEach(tx => {
        const li = document.createElement('li');
        const amount = typeof tx.amount === 'number' ? formatCurrency(tx.amount) : '';
        const formattedDate = tx.purchaseDate ? tx.purchaseDate.toLocaleDateString('pt-BR') : 'Data não registrada';

        li.innerHTML = `
            <div style="text-align: left; flex-grow: 1;">
                <span>${tx.description}</span>
                <small style="display: block; color: #7f8c8d;">${formattedDate}</small>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <span>${amount}</span>
                <div class="transaction-actions">
                    <button class="action-btn edit-btn" data-invoice-tx-id="${tx.id}" title="Editar">&#9998;</button>
                    <button class="action-btn delete-btn" data-invoice-tx-id="${tx.id}" title="Excluir">&times;</button>
                </div>
            </div>
        `;
        invoiceTransactionsList.appendChild(li);
    });
}


// --- Funções de Renderização para o Modal de Configurações ---

/** Renderiza as listas de categorias e subcategorias de forma aninhada. */
export function renderCategoryManagementList() {
    revenueCategoriesList.innerHTML = '';
    expenseCategoriesList.innerHTML = '';

    const createCategoryListItem = (category) => {
        // INÍCIO DA CORREÇÃO - Garante que subcategories seja um array
        const subcategoriesHtml = (category.subcategories || []).map(sub => `
            <li class="subcategory-item">
                <span>${sub}</span>
                <button class="action-btn delete-btn delete-subcategory-btn" data-subcategory-name="${sub}" title="Excluir Subcategoria">&times;</button>
            </li>
        `).join('');
        // FIM DA CORREÇÃO

        const li = document.createElement('li');
        li.className = 'category-item';
        li.dataset.categoryId = category.id;
        li.innerHTML = `
            <div class="category-item-header">
                <span class="category-name">${category.name}</span>
                <div class="category-actions">
                    <button class="action-btn delete-btn delete-category-btn" title="Excluir Categoria Principal">&times;</button>
                    <button class="action-btn toggle-subcategories-btn" title="Ver Subcategorias">&#9662;</button>
                </div>
            </div>
            <div class="subcategory-container" style="display: none;">
                <ul class="subcategory-list">${subcategoriesHtml}</ul>
                <form class="add-subcategory-form">
                    <input type="text" class="new-subcategory-name" placeholder="Nova subcategoria" required>
                    <button type="submit" class="button-secondary">Adicionar</button>
                </form>
            </div>
        `;
        return li;
    };

    state.userCategories.filter(c => c.type === 'revenue').forEach(cat => revenueCategoriesList.appendChild(createCategoryListItem(cat)));
    state.userCategories.filter(c => c.type === 'expense').forEach(cat => expenseCategoriesList.appendChild(createCategoryListItem(cat)));
}

/** Popula o select de categorias na aba de orçamentos. */
export function populateBudgetCategorySelect() {
    budgetCategorySelect.innerHTML = '';
    const expenseCategories = state.userCategories.filter(c => c.type === 'expense');
    expenseCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        budgetCategorySelect.appendChild(option);
    });
}

/** Renderiza a lista de orçamentos ativos. */
export function renderBudgetList() {
    budgetList.innerHTML = '';
    if (state.userBudgets.length === 0) {
        budgetList.innerHTML = '<li>Nenhum orçamento definido.</li>';
        return;
    }
    state.userBudgets.forEach(budget => {
        const li = document.createElement('li');
        li.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid var(--background-color);';
        li.innerHTML = `
            <span>${budget.category}: ${formatCurrency(budget.amount)}</span>
            <button class="action-btn delete-btn" data-budget-id="${budget.id}" title="Excluir orçamento">&times;</button>
        `;
        budgetList.appendChild(li);
    });
}

/** Renderiza a lista de transações recorrentes a partir dos dados do estado global. */
export function renderRecurringList() {
    const recurringTxs = state.userRecurringTransactions;
    recurringList.innerHTML = '';
    
    if (recurringTxs.length === 0) {
        recurringList.innerHTML = '<li>Nenhuma recorrência cadastrada.</li>';
        return;
    }

    recurringTxs.forEach(tx => {
        const li = document.createElement('li');
        li.className = tx.type;
        li.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid var(--background-color);';

        li.innerHTML = `
            <span style="flex-grow: 1; text-align: left;">
                Todo dia ${tx.dayOfMonth}: ${tx.description} (${formatCurrency(tx.amount)})
            </span>
            <div class="transaction-actions">
                <button class="action-btn edit-btn" data-recurring-id="${tx.id}" title="Editar">&#9998;</button>
                <button class="action-btn delete-btn" data-recurring-id="${tx.id}" title="Excluir">&times;</button>
            </div>
        `;
        recurringList.appendChild(li);
    });
}

/**
 * Renderiza a lista de usuários para o admin.
 * @param {Array<object>} users - A lista de usuários a ser renderizada.
 */
export function renderUserList(users) {
    userList.innerHTML = '';
    if (users.length === 0) {
        userList.innerHTML = '<li>Nenhum usuário encontrado.</li>';
        return;
    }
    users.forEach(user => {
        const li = document.createElement('li');
        li.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.8rem; border-bottom: 1px solid var(--background-color);';
        const actionsDiv = user.status === 'pending'
            ? `<div class="transaction-actions">
                   <button class="button-secondary approve-user-btn" data-user-id="${user.id}" style="background-color: var(--success-color);">Aprovar</button>
               </div>`
            : '';
        li.innerHTML = `
            <div style="text-align: left;">
                <span style="font-weight: bold;">${user.email}</span><br>
                <span class="status-badge ${user.status}">${user.status}</span>
            </div>
            ${actionsDiv}
        `;
        userList.appendChild(li);
    });
}

// --- Renderização de Componentes Específicos ---

/** Renderiza as barras de progresso dos orçamentos no dashboard. */
function renderBudgetProgress() {
    budgetProgressList.innerHTML = '';

    if (state.userBudgets.length === 0) {
        budgetProgressList.innerHTML = '<li>Nenhum orçamento definido. <a href="#" id="go-to-budgets">Definir agora</a></li>';
        return;
    }

    state.userBudgets.forEach(budget => {
        const spentAmount = state.allTransactions
            .filter(t => t.type === 'expense' && t.category === budget.category)
            .reduce((sum, t) => sum + t.amount, 0);

        const percentage = budget.amount > 0 ? (spentAmount / budget.amount) * 100 : 0;
        const cappedPercentage = Math.min(percentage, 100);

        let progressBarClass = 'safe';
        if (percentage > 90) progressBarClass = 'danger';
        else if (percentage > 70) progressBarClass = 'warning';

        const li = document.createElement('li');
        li.className = 'budget-item';
        li.innerHTML = `
            <div class="budget-item-header">
                <span>${budget.category}</span>
                <span class="budget-item-values">${formatCurrency(spentAmount)} / ${formatCurrency(budget.amount)}</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar ${progressBarClass}" style="width: ${cappedPercentage}%;">${Math.round(percentage)}%</div>
            </div>
        `;
        budgetProgressList.appendChild(li);
    });
}
