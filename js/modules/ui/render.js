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
import { unpackSplitTransactions } from '../analytics.js';

// --- Seleção de Elementos do DOM ---
const totalRevenueEl = document.getElementById('total-revenue');
const totalExpensesEl = document.getElementById('total-expenses');
const totalBalanceAccountsEl = document.getElementById('total-balance-accounts');
const accountsSummaryListEl = document.getElementById('accounts-summary-list');
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
const transactionAccountSelect = document.getElementById('transaction-account');
const editTransactionAccountSelect = document.getElementById('edit-transaction-account');
const accountList = document.getElementById('account-list');
const loadMoreButton = document.getElementById('load-more-button');
const transferFromAccountSelect = document.getElementById('transfer-from-account');
const transferToAccountSelect = document.getElementById('transfer-to-account');
const periodBalanceEl = document.getElementById('period-balance');
const upcomingInvoicesListEl = document.getElementById('upcoming-invoices-list');

// Elementos do Modal de Faturas
const invoiceTotalAmount = document.getElementById('invoice-total-amount');
const invoiceDueDate = document.getElementById('invoice-due-date');
const invoiceStatus = document.getElementById('invoice-status');
const invoiceTransactionsList = document.getElementById('invoice-transactions-list');
const invoicePeriodSelect = document.getElementById('invoice-period-select');


// --- Funções de Renderização do Dashboard Principal ---

/** Renderiza o dashboard: calcula totais, exibe a lista, e atualiza gráficos e orçamentos. */
export function updateDashboard() {
    const totalBalance = state.userAccounts.reduce((sum, account) => sum + account.currentBalance, 0);
    totalBalanceAccountsEl.textContent = formatCurrency(totalBalance);

    // Desdobra as transações para garantir que os cálculos usem os dados corretos
    const unpackedTransactions = unpackSplitTransactions(state.allTransactions);

    let periodRevenue = 0;
    let periodExpenses = 0;
    unpackedTransactions.forEach(t => {
        if (t.type === 'revenue') {
            periodRevenue += t.amount;
        } else if (t.type === 'expense') {
            periodExpenses += t.amount;
        }
    });

    totalRevenueEl.textContent = formatCurrency(periodRevenue);
    totalExpensesEl.textContent = formatCurrency(periodExpenses);

    const balance = periodRevenue - periodExpenses;
    periodBalanceEl.textContent = formatCurrency(balance);
    if (balance > 0) {
        periodBalanceEl.style.color = 'var(--revenue-color)';
    } else if (balance < 0) {
        periodBalanceEl.style.color = 'var(--expense-color)';
    } else {
        periodBalanceEl.style.color = 'var(--text-color)';
    }

    renderAccountsSummaryList();
    renderTransactionList(state.filteredTransactions); // A lista de exibição não precisa ser desdobrada
    charts.renderExpensesChart(state.filteredTransactions.filter(t => t.type === 'expense'));
    renderBudgetProgress();
}

/**
 * Renderiza a lista de transações na tela, com opção de adicionar ao final da lista.
 * @param {Array<object>} transactionsToRender - A lista de transações a ser exibida.
 * @param {boolean} [append=false] - Se true, adiciona as transações ao final da lista existente.
 */
export function renderTransactionList(transactionsToRender, append = false) {
    if (!append) {
        transactionsListEl.innerHTML = '';
    }

    if (state.allTransactions.length === 0) {
        transactionsListEl.innerHTML = '<li>Nenhuma transação encontrada para os filtros aplicados.</li>';
    } else {
        transactionsToRender.forEach(transaction => {
            const li = document.createElement('li');
            li.dataset.id = transaction.id;

            const formattedDate = transaction.date.toLocaleDateString('pt-BR');

            if (transaction.type === 'transfer') {
                li.classList.add('transfer');
                const fromAccount = state.userAccounts.find(acc => acc.id === transaction.fromAccountId);
                const toAccount = state.userAccounts.find(acc => acc.id === transaction.toAccountId);

                li.innerHTML = `
                    <div style="text-align: left;">
                        <span class="transaction-description">
                            &#8644; Transferência de <strong>${fromAccount?.name || '?'}</strong> para <strong>${toAccount?.name || '?'}</strong>
                        </span>
                        <span style="display: block; font-size: 0.8rem; color: #7f8c8d;">
                            ${formattedDate} ${transaction.description ? `• ${transaction.description}` : ''}
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
            } else {
                li.classList.add(transaction.type);
                let categoryDisplay;
                if (transaction.isSplit) {
                    categoryDisplay = transaction.splits.map(s => s.category).join(', ');
                } else {
                    categoryDisplay = transaction.subcategory 
                        ? `${transaction.category} / ${transaction.subcategory}` 
                        : transaction.category;
                }

                const tagsHtml = (transaction.tags && transaction.tags.length > 0)
                    ? `<div class="transaction-tags">
                        ${transaction.tags.map(tag => `<span class="tag-badge">#${tag}</span>`).join('')}
                       </div>`
                    : '';

                const account = state.userAccounts.find(acc => acc.id === transaction.accountId);
                const accountName = account ? account.name : 'Conta não informada';

                li.innerHTML = `
                    <div style="text-align: left; flex-grow: 1;">
                        <span class="transaction-description">${transaction.description}</span>
                        <span style="display: block; font-size: 0.8rem; color: #7f8c8d;">
                            ${formattedDate} • ${accountName} • ${categoryDisplay || ''}
                        </span>
                        ${tagsHtml}
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span class="transaction-amount">${formatCurrency(transaction.amount)}</span>
                        <div class="transaction-actions">
                            <button class="action-btn edit-btn" title="Editar">&#9998;</button>
                            <button class="action-btn delete-btn" title="Excluir">&times;</button>
                        </div>
                    </div>
                `;
            }
            transactionsListEl.appendChild(li);
        });
    }

    if (state.hasMoreTransactions) {
        loadMoreButton.style.display = 'block';
    } else {
        loadMoreButton.style.display = 'none';
    }
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
    const recurringCardSelect = document.getElementById('recurring-card');
    const editRecurringCardSelect = document.getElementById('edit-recurring-card');

    const selects = [creditCardSelect, editCreditCardSelect, recurringCardSelect, editRecurringCardSelect];
    
    selects.forEach(select => { if(select) select.innerHTML = ''; });

    if (state.userCreditCards.length === 0) {
        const option = '<option disabled value="">Nenhum cartão cadastrado</option>';
        selects.forEach(select => { if(select) select.innerHTML = option; });
    } else {
        state.userCreditCards.forEach(card => {
            const option = document.createElement('option');
            option.value = card.id;
            option.textContent = card.name;
            selects.forEach(select => { if(select) select.appendChild(option.cloneNode(true)); });
        });
    }
}

/** Popula os <select> de conta com as contas do usuário. */
export function populateAccountSelects() {
    const advancePaymentAccountSelect = document.getElementById('advance-payment-account-select');
    const payInvoiceAccountSelect = document.getElementById('pay-invoice-account-select');
    const editTransferFromAccountSelect = document.getElementById('edit-transfer-from-account');
    const editTransferToAccountSelect = document.getElementById('edit-transfer-to-account');
    const recurringAccountSelect = document.getElementById('recurring-account');
    const editRecurringAccountSelect = document.getElementById('edit-recurring-account');
    // INÍCIO DA ALTERAÇÃO
    const assetInitialAccountSelect = document.getElementById('asset-initial-account');
    const movementAccountSelect = document.getElementById('movement-account');
    const proventoAccountSelect = document.getElementById('provento-account');
    // FIM DA ALTERAÇÃO
    
    const selects = [
        transactionAccountSelect, editTransactionAccountSelect, transferFromAccountSelect, 
        transferToAccountSelect, payInvoiceAccountSelect, advancePaymentAccountSelect,
        editTransferFromAccountSelect, editTransferToAccountSelect, recurringAccountSelect,
        editRecurringAccountSelect, 
        // INÍCIO DA ALTERAÇÃO
        assetInitialAccountSelect, movementAccountSelect, proventoAccountSelect
        // FIM DA ALTERAÇÃO
    ];

    selects.forEach(select => { if(select) select.innerHTML = ''; });

    if (state.userAccounts.length === 0) {
        const option = '<option disabled value="">Nenhuma conta cadastrada</option>';
        selects.forEach(select => { if(select) select.innerHTML = option; });
    } else {
        state.userAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.name} (${formatCurrency(account.currentBalance)})`;
            selects.forEach(select => { if(select) select.appendChild(option.cloneNode(true)); });
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
                <div class="card-info" data-card-id="${card.id}" style="flex-grow: 1; cursor: pointer; display: flex; flex-direction: column; align-items: flex-start;">
                    <span style="font-weight: bold;">${card.name}</span>
                    <small style="font-size: 0.8rem; color: #7f8c8d;">
                        Limite: ${formatCurrency(card.limit || 0)}
                    </small>
                    <small style="font-size: 0.8rem; color: #7f8c8d;">
                        Fecha dia ${card.closingDay} | Vence dia ${card.dueDay}
                    </small>
                </div>
                <div class="transaction-actions">
                    <button class="action-btn edit-btn" data-card-id="${card.id}" title="Editar Cartão">&#9998;</button>
                    <button class="action-btn delete-btn" data-card-id="${card.id}" title="Excluir cartão">&times;</button>
                </div>
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

/** Renderiza a lista de contas na aba de gerenciamento de contas. */
export function renderAccountList() {
    accountList.innerHTML = '';
    if (state.userAccounts.length === 0) {
        accountList.innerHTML = '<li>Nenhuma conta cadastrada.</li>';
        return;
    }
    state.userAccounts.forEach(account => {
        const li = document.createElement('li');
        li.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid var(--background-color);';
        li.innerHTML = `
            <span>${account.name}: ${formatCurrency(account.currentBalance)}</span>
            <button class="action-btn delete-btn" data-account-id="${account.id}" title="Excluir conta">&times;</button>
        `;
        accountList.appendChild(li);
    });
}

/** Renderiza as listas de categorias e subcategorias de forma aninhada. */
export function renderCategoryManagementList() {
    revenueCategoriesList.innerHTML = '';
    expenseCategoriesList.innerHTML = '';

    const createCategoryListItem = (category) => {
        const subcategoriesHtml = (category.subcategories || []).map(sub => `
            <li class="subcategory-item">
                <span>${sub}</span>
                <button class="action-btn delete-btn delete-subcategory-btn" data-subcategory-name="${sub}" title="Excluir Subcategoria">&times;</button>
            </li>
        `).join('');

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

        let paymentTargetName = '';
        if (tx.paymentMethod === 'credit_card') {
            const card = state.userCreditCards.find(c => c.id === tx.cardId);
            paymentTargetName = `(Cartão: ${card ? card.name : '...'})`;
        } else {
            const account = state.userAccounts.find(a => a.id === tx.accountId);
            paymentTargetName = `(Conta: ${account ? account.name : '...'})`;
        }

        li.innerHTML = `
            <span style="flex-grow: 1; text-align: left;">
                Todo dia ${tx.dayOfMonth}: ${tx.description} (${formatCurrency(tx.amount)})
                <small style="display: block; color: #7f8c8d;">${paymentTargetName}</small>
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

/** Renderiza a lista de contas e saldos na tela principal. */
function renderAccountsSummaryList() {
    accountsSummaryListEl.innerHTML = '';
    if (state.userAccounts.length === 0) {
        accountsSummaryListEl.innerHTML = '<li>Nenhuma conta cadastrada. <a href="#" id="go-to-accounts">Cadastrar agora</a></li>';
        return;
    }
    state.userAccounts.forEach(account => {
        const li = document.createElement('li');
        li.className = 'account-summary-item';
        li.innerHTML = `
            <span class="account-name">${account.name}</span>
            <span class="account-balance">${formatCurrency(account.currentBalance)}</span>
        `;
        accountsSummaryListEl.appendChild(li);
    });
}

/**
 * Renderiza a lista de próximas faturas no dashboard.
 * @param {Array<object>} invoices - Lista de faturas a serem exibidas.
 */
export function renderUpcomingInvoicesList(invoices) {
    upcomingInvoicesListEl.innerHTML = '';

    if (invoices.length === 0) {
        upcomingInvoicesListEl.innerHTML = '<li>Nenhuma fatura em aberto ou fechada encontrada.</li>';
        return;
    }

    invoices.forEach(invoice => {
        const card = state.userCreditCards.find(c => c.id === invoice.cardId);
        const cardName = card ? card.name : 'Cartão não encontrado';

        const li = document.createElement('li');
        li.className = 'upcoming-invoice-item';
        li.innerHTML = `
            <div>
                <span class="invoice-card-name">${cardName}</span>
                <small class="invoice-due-date">Vence em: ${invoice.dueDate.toLocaleDateString('pt-BR')}</small>
            </div>
            <div>
                <span class="invoice-amount">${formatCurrency(invoice.totalAmount)}</span>
                <span class="status-badge ${invoice.status}">${invoice.status}</span>
            </div>
        `;
        upcomingInvoicesListEl.appendChild(li);
    });
}

/** Renderiza as barras de progresso dos orçamentos no dashboard. */
function renderBudgetProgress() {
    budgetProgressList.innerHTML = '';

    if (state.userBudgets.length === 0) {
        budgetProgressList.innerHTML = '<li>Nenhum orçamento definido. <a href="#" id="go-to-budgets">Definir agora</a></li>';
        return;
    }

    const unpackedTransactions = unpackSplitTransactions(state.allTransactions);

    const currentMonthTransactions = unpackedTransactions
        .filter(t => t.date.getMonth() === new Date().getMonth() && t.date.getFullYear() === new Date().getFullYear());

    state.userBudgets.forEach(budget => {
        const spentAmount = currentMonthTransactions
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
