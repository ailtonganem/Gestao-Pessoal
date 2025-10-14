// Importa as funções de autenticação.
import { registerUser, loginUser, logoutUser, monitorAuthState, getUserProfile, sendPasswordReset } from './modules/auth.js';
// Importa as funções de transações.
import { addTransaction, getTransactions, deleteTransaction, updateTransaction } from './modules/transactions.js';
// Importa as funções de gerenciamento de categoria.
import { getCategories, addCategory, deleteCategory } from './modules/categories.js';
// Importa as funções de cartão de crédito.
import { addCreditCard, getCreditCards, deleteCreditCard } from './modules/creditCard.js';
// Importa as funções de faturas.
import { getInvoices, getInvoiceTransactions, payInvoice, closeOverdueInvoices } from './modules/invoices.js';
// Importa o módulo de admin.
import { getAllUsers, updateUserStatus } from './modules/admin.js';
// Importa o módulo de recorrências.
import { addRecurringTransaction, getRecurringTransactions, deleteRecurringTransaction, processRecurringTransactions } from './modules/recurring.js';
// Importa o módulo de análise
import { getMonthlySummary } from './modules/analytics.js';
// Importa o módulo de orçamento
import { setBudget, getBudgets, deleteBudget } from './modules/budget.js';

// --- Variáveis de Estado ---
let currentUser = null;
let currentUserProfile = null;
let userCreditCards = []; 
let userCategories = [];
let userBudgets = [];
let allTransactions = [];
let selectedCardForInvoiceView = null;
let currentCardInvoices = [];
let expensesChart = null; 
let trendsChart = null;

// --- Seleção de Elementos do DOM ---
const loadingDiv = document.getElementById('loading');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginSection = document.getElementById('login-form');
const registerSection = document.getElementById('register-form');
const loginForm = loginSection.querySelector('form');
const registerForm = registerSection.querySelector('form');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');
const showRegisterLink = document.getElementById('show-register-link');
const showLoginLink = document.getElementById('show-login-link');
const logoutButton = document.getElementById('logout-button');
const addTransactionForm = document.getElementById('add-transaction-form');
const transactionDescriptionInput = document.getElementById('transaction-description');
const transactionAmountInput = document.getElementById('transaction-amount');
const transactionDateInput = document.getElementById('transaction-date');
const transactionTypeRadios = document.querySelectorAll('input[name="transaction-type"]');
const transactionCategorySelect = document.getElementById('transaction-category');
const paymentMethodSelect = document.getElementById('payment-method');
const creditCardWrapper = document.getElementById('credit-card-wrapper');
const creditCardSelect = document.getElementById('credit-card-select');
const totalRevenueEl = document.getElementById('total-revenue');
const totalExpensesEl = document.getElementById('total-expenses');
const finalBalanceEl = document.getElementById('final-balance');
const transactionsListEl = document.getElementById('transactions-list');
const notificationContainer = document.getElementById('notification-container');
const editModal = document.getElementById('edit-modal');
const closeButton = document.querySelector('.close-button');
const editTransactionForm = document.getElementById('edit-transaction-form');
const editTransactionIdInput = document.getElementById('edit-transaction-id');
const editTransactionDescriptionInput = document.getElementById('edit-transaction-description');
const editTransactionAmountInput = document.getElementById('edit-transaction-amount');
const editTransactionDateInput = document.getElementById('edit-transaction-date');
const editTransactionTypeRadios = document.querySelectorAll('input[name="edit-transaction-type"]');
const editTransactionCategorySelect = document.getElementById('edit-transaction-category');
const editPaymentMethodSelect = document.getElementById('edit-payment-method');
const editCreditCardWrapper = document.getElementById('edit-credit-card-wrapper');
const manageCardsButton = document.getElementById('manage-cards-button');
const creditCardModal = document.getElementById('credit-card-modal');
const closeCardModalButton = document.querySelector('.close-card-modal-button');
const creditCardList = document.getElementById('credit-card-list');
const addCreditCardForm = document.getElementById('add-credit-card-form');
const cardNameInput = document.getElementById('card-name');
const cardClosingDayInput = document.getElementById('card-closing-day');
const cardDueDayInput = document.getElementById('card-due-day');
const cardManagementView = document.getElementById('card-management-view');
const invoiceDetailsView = document.getElementById('invoice-details-view');
const backToCardsButton = document.getElementById('back-to-cards-button');
const invoiceCardName = document.getElementById('invoice-card-name');
const invoicePeriodSelect = document.getElementById('invoice-period-select');
const invoiceTotalAmount = document.getElementById('invoice-total-amount');
const invoiceDueDate = document.getElementById('invoice-due-date');
const invoiceStatus = document.getElementById('invoice-status');
const invoiceTransactionsList = document.getElementById('invoice-transactions-list');
const payInvoiceButton = document.getElementById('pay-invoice-button');
const filterMonthSelect = document.getElementById('filter-month');
const filterYearSelect = document.getElementById('filter-year');
const chartCanvas = document.getElementById('expenses-chart');
const trendsChartCanvas = document.getElementById('trends-chart');
const settingsButton = document.getElementById('settings-button');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsModalButton = document.querySelector('.close-settings-modal-button');
const addCategoryForm = document.getElementById('add-category-form');
const newCategoryNameInput = document.getElementById('new-category-name');
const revenueCategoriesList = document.getElementById('revenue-categories-list');
const expenseCategoriesList = document.getElementById('expense-categories-list');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const pendingApprovalSection = document.getElementById('pending-approval');
const logoutPendingButton = document.getElementById('logout-pending-button');
const adminTabButton = document.getElementById('admin-tab-button');
const userList = document.getElementById('user-list');
const tabLinks = document.querySelectorAll('.tab-link');
const tabContents = document.querySelectorAll('.tab-content');
const addRecurringForm = document.getElementById('add-recurring-form');
const recurringDescriptionInput = document.getElementById('recurring-description');
const recurringAmountInput = document.getElementById('recurring-amount');
const recurringDayInput = document.getElementById('recurring-day');
const recurringCategorySelect = document.getElementById('recurring-category');
const recurringTypeRadios = document.querySelectorAll('input[name="recurring-type"]');
const recurringList = document.getElementById('recurring-list');
const filterDescriptionInput = document.getElementById('filter-description');
const filterCategorySelect = document.getElementById('filter-category');
const filterPaymentMethodSelect = document.getElementById('filter-payment-method');
const setBudgetForm = document.getElementById('set-budget-form');
const budgetCategorySelect = document.getElementById('budget-category');
const budgetAmountInput = document.getElementById('budget-amount');
const budgetList = document.getElementById('budget-list');
const budgetProgressList = document.getElementById('budget-progress-list');
// INÍCIO DA ALTERAÇÃO
const themeToggle = document.getElementById('theme-toggle');
// FIM DA ALTERAÇÃO

// --- Funções de Manipulação da UI e Gráfico ---

/** Renderiza o gráfico de despesas por categoria (pizza). */
function renderExpensesChart(transactions) {
    const expenses = transactions.filter(t => t.type === 'expense');
    
    const spendingByCategory = expenses.reduce((acc, transaction) => {
        const { category, amount } = transaction;
        if (!acc[category]) {
            acc[category] = 0;
        }
        acc[category] += amount;
        return acc;
    }, {});

    const labels = Object.keys(spendingByCategory);
    const data = Object.values(spendingByCategory);

    if (expensesChart) {
        expensesChart.destroy();
    }

    if (labels.length === 0) {
        return;
    }

    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Despesas por Categoria',
            data: data,
            backgroundColor: labels.map(() => `hsl(${Math.random() * 360}, 70%, 50%)`),
            hoverOffset: 4
        }]
    };

    expensesChart = new Chart(chartCanvas, {
        type: 'pie',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        // Altera a cor do texto da legenda com base no tema
                        color: document.body.classList.contains('dark-mode') ? '#bdc3c7' : '#34495e'
                    }
                }
            }
        }
    });
}

/** Renderiza o gráfico de evolução mensal de receitas e despesas. */
function renderTrendsChart(summaryData) {
    if (trendsChart) {
        trendsChart.destroy();
    }

    const data = {
        labels: summaryData.labels,
        datasets: [
            {
                label: 'Receitas',
                data: summaryData.revenues,
                backgroundColor: 'rgba(46, 204, 113, 0.7)',
                borderColor: 'rgba(46, 204, 113, 1)',
                borderWidth: 1
            },
            {
                label: 'Despesas',
                data: summaryData.expenses,
                backgroundColor: 'rgba(231, 76, 60, 0.7)',
                borderColor: 'rgba(231, 76, 60, 1)',
                borderWidth: 1
            }
        ]
    };

    const textColor = document.body.classList.contains('dark-mode') ? '#bdc3c7' : '#34495e';

    trendsChart = new Chart(trendsChartCanvas, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: textColor
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: textColor
                    },
                    grid: {
                        color: textColor.replace(')', ', 0.1)') // Deixa as linhas da grade mais transparentes
                    }
                },
                x: {
                    ticks: {
                        color: textColor
                    },
                    grid: {
                        color: 'transparent'
                    }
                }
            }
        }
    });
}

/** Popula o dropdown de anos. */
function populateYearFilter() {
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

/** Popula um elemento <select> com as categorias do usuário. */
function populateCategorySelects(type, selectElement) {
    const filteredCategories = userCategories.filter(cat => cat.type === type);
    selectElement.innerHTML = '';

    if (filteredCategories.length === 0) {
        const option = document.createElement('option');
        option.textContent = `Nenhuma categoria de ${type === 'revenue' ? 'receita' : 'despesa'} cadastrada`;
        option.disabled = true;
        selectElement.appendChild(option);
        return;
    }

    filteredCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        selectElement.appendChild(option);
    });
}

/** Popula os <select> de cartão de crédito com os cartões do usuário. */
function populateCreditCardSelects() {
    creditCardSelect.innerHTML = '';
    const editCreditCardSelect = document.getElementById('edit-credit-card-select');
    editCreditCardSelect.innerHTML = '';

    if (userCreditCards.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'Nenhum cartão cadastrado';
        option.disabled = true;
        creditCardSelect.appendChild(option);
        editCreditCardSelect.appendChild(option.cloneNode(true));
    } else {
        userCreditCards.forEach(card => {
            const option = document.createElement('option');
            option.value = card.id;
            option.textContent = card.name;
            creditCardSelect.appendChild(option.cloneNode(true));
            editCreditCardSelect.appendChild(option.cloneNode(true));
        });
    }
}

/** Exibe os detalhes de uma fatura selecionada. */
async function displayInvoiceDetails(invoice) {
    invoiceTotalAmount.textContent = formatCurrency(invoice.totalAmount);
    invoiceDueDate.textContent = invoice.dueDate.toLocaleDateString('pt-BR');
    
    invoiceStatus.textContent = invoice.status;
    invoiceStatus.className = 'status-badge';
    invoiceStatus.classList.add(invoice.status);

    payInvoiceButton.disabled = invoice.status !== 'closed';

    invoiceTransactionsList.innerHTML = '<li>Carregando...</li>';
    try {
        const transactions = await getInvoiceTransactions(invoice.id);
        invoiceTransactionsList.innerHTML = '';
        if (transactions.length === 0) {
            invoiceTransactionsList.innerHTML = '<li>Nenhum lançamento nesta fatura.</li>';
        } else {
            transactions.forEach(tx => {
                const li = document.createElement('li');
                const descriptionSpan = document.createElement('span');
                descriptionSpan.textContent = tx.description;
                const amountSpan = document.createElement('span');
                amountSpan.textContent = formatCurrency(tx.amount);
                li.appendChild(descriptionSpan);
                li.appendChild(amountSpan);
                invoiceTransactionsList.appendChild(li);
            });
        }
    } catch (error) {
        showNotification(error.message, 'error');
        invoiceTransactionsList.innerHTML = '<li>Erro ao carregar lançamentos.</li>';
    }
}

/** Carrega as faturas de um cartão e popula o dropdown de seleção. */
async function loadAndDisplayInvoices(card) {
    invoicePeriodSelect.innerHTML = '<option>Carregando faturas...</option>';
    try {
        currentCardInvoices = await getInvoices(card.id);
        invoicePeriodSelect.innerHTML = '';

        if (currentCardInvoices.length === 0) {
            invoicePeriodSelect.innerHTML = '<option>Nenhuma fatura encontrada</option>';
            invoiceTotalAmount.textContent = formatCurrency(0);
            invoiceDueDate.textContent = '--/--/----';
            invoiceStatus.textContent = '--';
            invoiceStatus.className = 'status-badge';
            invoiceTransactionsList.innerHTML = '<li>Nenhum lançamento.</li>';
            payInvoiceButton.disabled = true;
        } else {
            currentCardInvoices.forEach(invoice => {
                const option = document.createElement('option');
                option.value = invoice.id;
                option.textContent = `${invoice.month.toString().padStart(2, '0')}/${invoice.year} (${invoice.status})`;
                invoicePeriodSelect.appendChild(option);
            });
            displayInvoiceDetails(currentCardInvoices[0]);
        }
    } catch (error) {
        showNotification(error.message, 'error');
        invoicePeriodSelect.innerHTML = '<option>Erro ao carregar faturas</option>';
    }
}

/** Troca a visão no modal para a de detalhes da fatura e inicia o carregamento. */
function showInvoiceDetailsView(card) {
    selectedCardForInvoiceView = card;
    invoiceCardName.textContent = `Faturas - ${card.name}`;
    loadAndDisplayInvoices(card);
    cardManagementView.style.display = 'none';
    invoiceDetailsView.style.display = 'block';
}

/** Troca a visão no modal de volta para a lista de cartões. */
function showCardManagementView() {
    selectedCardForInvoiceView = null;
    currentCardInvoices = [];
    cardManagementView.style.display = 'block';
    invoiceDetailsView.style.display = 'none';
}

/** Renderiza a lista de cartões no modal, adicionando eventos de clique para ver faturas e excluir. */
function renderCreditCardList() {
    creditCardList.innerHTML = '';
    if (userCreditCards.length === 0) {
        creditCardList.innerHTML = '<li>Nenhum cartão cadastrado.</li>';
    } else {
        userCreditCards.forEach(card => {
            const li = document.createElement('li');

            const cardInfo = document.createElement('div');
            cardInfo.className = 'card-info';
            cardInfo.textContent = `${card.name} (Fecha dia ${card.closingDay}, Vence dia ${card.dueDay})`;
            cardInfo.addEventListener('click', () => showInvoiceDetailsView(card));

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '&times;';
            deleteButton.classList.add('action-btn', 'delete-btn');
            deleteButton.title = 'Excluir cartão';
            deleteButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Tem certeza que deseja excluir o cartão "${card.name}"? Esta ação não pode ser desfeita.`)) {
                    try {
                        await deleteCreditCard(card.id);
                        showNotification('Cartão excluído com sucesso!');
                        loadUserCreditCards();
                    } catch (error) {
                        showNotification(error.message, 'error');
                    }
                }
            });

            li.appendChild(cardInfo);
            li.appendChild(deleteButton);
            creditCardList.appendChild(li);
        });
    }
}

/** Exibe uma notificação "toast" na tela. */
function showNotification(message, type = 'success') {
    const toast = document.createElement('div');
    toast.classList.add('toast', type);
    toast.textContent = message;
    notificationContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

/** Formata um objeto Date para uma string no formato 'YYYY-MM-DD'. */
function formatDateToInput(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Abre e preenche o modal de edição com os dados da transação. */
function openEditModal(transaction) {
    editTransactionIdInput.value = transaction.id;
    editTransactionDescriptionInput.value = transaction.description;
    editTransactionAmountInput.value = transaction.amount;
    editTransactionDateInput.value = formatDateToInput(transaction.date);
    document.querySelector(`input[name="edit-transaction-type"][value="${transaction.type}"]`).checked = true;
    
    populateCategorySelects(transaction.type, editTransactionCategorySelect);
    editTransactionCategorySelect.value = transaction.category;

    editPaymentMethodSelect.value = transaction.paymentMethod;
    editCreditCardWrapper.style.display = transaction.paymentMethod === 'credit_card' ? 'block' : 'none';

    editModal.style.display = 'flex';
}

/** Fecha o modal de edição. */
function closeEditModal() {
    editModal.style.display = 'none';
}

/** Abre o modal de gerenciamento de cartões. */
async function openCardModal() {
    if (currentUser && selectedCardForInvoiceView) {
        await loadAndDisplayInvoices(selectedCardForInvoiceView);
    }
    showCardManagementView();
    creditCardModal.style.display = 'flex';
}

/** Fecha o modal de gerenciamento de cartões. */
function closeCardModal() {
    creditCardModal.style.display = 'none';
}

/** Abre o modal de configurações. */
function openSettingsModal() {
    if (currentUserProfile) {
        if (currentUserProfile.role === 'admin') {
            renderUserList();
        }
        renderRecurringList();
        renderBudgetList();
    }
    settingsModal.style.display = 'flex';
}

/** Fecha o modal de configurações. */
function closeSettingsModal() {
    settingsModal.style.display = 'none';
}

/** Formata um número para o padrão de moeda BRL. */
function formatCurrency(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Renderiza o dashboard: aplica filtros, calcula totais, exibe a lista e atualiza o gráfico. */
function updateDashboard() {
    const descriptionFilter = filterDescriptionInput.value.toLowerCase();
    const categoryFilter = filterCategorySelect.value;
    const paymentMethodFilter = filterPaymentMethodSelect.value;

    const filteredTransactions = allTransactions.filter(transaction => {
        const descriptionMatch = transaction.description.toLowerCase().includes(descriptionFilter);
        const categoryMatch = (categoryFilter === 'all') || (transaction.category === categoryFilter);
        const paymentMethodMatch = (paymentMethodFilter === 'all') || (transaction.paymentMethod === paymentMethodFilter);
        
        return descriptionMatch && categoryMatch && paymentMethodMatch;
    });

    let totalRevenue = 0;
    let totalExpenses = 0;
    transactionsListEl.innerHTML = '';

    const transactionsToRender = filteredTransactions;

    if (transactionsToRender.length === 0) {
        transactionsListEl.innerHTML = '<li>Nenhuma transação encontrada para os filtros aplicados.</li>';
    } else {
        transactionsToRender.forEach(transaction => {
            if (transaction.type === 'revenue') {
                totalRevenue += transaction.amount;
            } else {
                totalExpenses += transaction.amount;
            }

            const li = document.createElement('li');
            li.classList.add(transaction.type);
            
            const transactionInfo = document.createElement('div');
            transactionInfo.style.textAlign = 'left';

            const descriptionSpan = document.createElement('span');
            descriptionSpan.className = 'transaction-description';
            descriptionSpan.textContent = transaction.description;
            
            const detailsSpan = document.createElement('span');
            detailsSpan.style.display = 'block';
            detailsSpan.style.fontSize = '0.8rem';
            detailsSpan.style.color = '#7f8c8d';
            const formattedDate = transaction.date.toLocaleDateString('pt-BR');
            detailsSpan.textContent = `${formattedDate} • ${transaction.category || ''} • ${transaction.paymentMethod || ''}`;
            
            const rightSide = document.createElement('div');
            rightSide.style.display = 'flex';
            rightSide.style.alignItems = 'center';
            rightSide.style.gap = '1rem';
            
            const amountSpan = document.createElement('span');
            amountSpan.className = 'transaction-amount';
            amountSpan.textContent = formatCurrency(transaction.amount);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'transaction-actions';
            
            const editButton = document.createElement('button');
            editButton.innerHTML = '&#9998;';
            editButton.classList.add('action-btn', 'edit-btn');
            editButton.onclick = () => openEditModal(transaction);
            
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '&times;';
            deleteButton.classList.add('action-btn', 'delete-btn');
            deleteButton.onclick = async () => {
                if (confirm(`Tem certeza que deseja excluir a transação "${transaction.description}"?`)) {
                    try {
                        await deleteTransaction(transaction.id);
                        showNotification('Transação excluída com sucesso!');
                        loadUserDashboard();
                    } catch (error) {
                        showNotification(error.message, 'error');
                    }
                }
            };

            transactionInfo.appendChild(descriptionSpan);
            transactionInfo.appendChild(detailsSpan);
            actionsDiv.appendChild(editButton);
            actionsDiv.appendChild(deleteButton);
            rightSide.appendChild(amountSpan);
            rightSide.appendChild(actionsDiv);
            li.appendChild(transactionInfo);
            li.appendChild(rightSide);
            transactionsListEl.appendChild(li);
        });
    }

    let fullPeriodRevenue = 0;
    let fullPeriodExpenses = 0;
    allTransactions.forEach(t => {
        if (t.type === 'revenue') fullPeriodRevenue += t.amount;
        else fullPeriodExpenses += t.amount;
    });

    totalRevenueEl.textContent = formatCurrency(fullPeriodRevenue);
    totalExpensesEl.textContent = formatCurrency(fullPeriodExpenses);
    finalBalanceEl.textContent = formatCurrency(fullPeriodRevenue - fullPeriodExpenses);

    renderExpensesChart(transactionsToRender);
    renderBudgetProgress();
}

/** Busca os dados do usuário e chama a função para atualizar o dashboard. */
async function loadUserDashboard() {
    if (!currentUser) return;
    transactionsListEl.innerHTML = '<li>Carregando transações...</li>';
    
    const filters = {
        month: filterMonthSelect.value,
        year: filterYearSelect.value
    };

    try {
        allTransactions = await getTransactions(currentUser.uid, filters);
        updateDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/** Busca os cartões de crédito do usuário e atualiza a UI. */
async function loadUserCreditCards() {
    if (!currentUser) return;
    try {
        userCreditCards = await getCreditCards(currentUser.uid);
        populateCreditCardSelects();
        renderCreditCardList();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/** Renderiza as listas de categorias no modal de configurações. */
function renderCategoryManagementList() {
    revenueCategoriesList.innerHTML = '';
    expenseCategoriesList.innerHTML = '';

    const revenueCats = userCategories.filter(c => c.type === 'revenue');
    const expenseCats = userCategories.filter(c => c.type === 'expense');

    const createCategoryListItem = (category, listElement) => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.padding = '0.5rem';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = category.name;

        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '&times;';
        deleteButton.classList.add('action-btn', 'delete-btn');
        deleteButton.title = 'Excluir categoria';
        deleteButton.onclick = async () => {
            if (confirm(`Tem certeza que deseja excluir a categoria "${category.name}"?`)) {
                try {
                    await deleteCategory(category.id);
                    showNotification('Categoria excluída com sucesso!');
                    loadUserCategories();
                } catch (error) {
                    showNotification(error.message, 'error');
                }
            }
        };

        li.appendChild(nameSpan);
        li.appendChild(deleteButton);
        listElement.appendChild(li);
    };

    revenueCats.forEach(cat => createCategoryListItem(cat, revenueCategoriesList));
    expenseCats.forEach(cat => createCategoryListItem(cat, expenseCategoriesList));
}

/** Busca as categorias do usuário e atualiza a UI (listas e dropdowns). */
async function loadUserCategories() {
    if (!currentUser) return;
    try {
        userCategories = await getCategories(currentUser.uid);
        renderCategoryManagementList();

        filterCategorySelect.innerHTML = '<option value="all">Todas</option>';
        userCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            filterCategorySelect.appendChild(option);
        });
        
        const expenseCategories = userCategories.filter(c => c.type === 'expense');
        budgetCategorySelect.innerHTML = '';
        expenseCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            budgetCategorySelect.appendChild(option);
        });

        const currentTransactionType = document.querySelector('input[name="transaction-type"]:checked').value;
        populateCategorySelects(currentTransactionType, transactionCategorySelect);
        const currentRecurringType = document.querySelector('input[name="recurring-type"]:checked').value;
        populateCategorySelects(currentRecurringType, recurringCategorySelect);
        populateCategorySelects('expense', editTransactionCategorySelect);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/** Renderiza a lista de usuários para o admin. */
async function renderUserList() {
    userList.innerHTML = '<li>Carregando usuários...</li>';
    try {
        const users = await getAllUsers();
        userList.innerHTML = '';

        if (users.length === 0) {
            userList.innerHTML = '<li>Nenhum usuário encontrado.</li>';
            return;
        }

        users.forEach(user => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '0.8rem';
            li.style.borderBottom = '1px solid var(--background-color)';

            const userInfo = document.createElement('div');
            userInfo.style.textAlign = 'left';
            const emailSpan = document.createElement('span');
            emailSpan.style.fontWeight = 'bold';
            emailSpan.textContent = user.email;
            const statusBadge = document.createElement('span');
            statusBadge.textContent = user.status;
            statusBadge.className = `status-badge ${user.status}`;
            userInfo.appendChild(emailSpan);
            userInfo.appendChild(document.createElement('br'));
            userInfo.appendChild(statusBadge);

            const actionsDiv = document.createElement('div');
            actionsDiv.style.display = 'flex';
            actionsDiv.style.gap = '0.5rem';

            if (user.status === 'pending') {
                const approveButton = document.createElement('button');
                approveButton.textContent = 'Aprovar';
                approveButton.classList.add('button-secondary');
                approveButton.style.backgroundColor = 'var(--success-color)';
                approveButton.onclick = async () => {
                    if (confirm(`Aprovar o usuário ${user.email}?`)) {
                        try {
                            await updateUserStatus(user.id, 'approved');
                            showNotification('Usuário aprovado!');
                            renderUserList();
                        } catch (error) {
                            showNotification(error.message, 'error');
                        }
                    }
                };
                actionsDiv.appendChild(approveButton);
            }
            
            li.appendChild(userInfo);
            li.appendChild(actionsDiv);
            userList.appendChild(li);
        });
    } catch (error) {
        showNotification(error.message, 'error');
        userList.innerHTML = '<li>Erro ao carregar usuários.</li>';
    }
}

/** Renderiza a lista de recorrências cadastradas. */
async function renderRecurringList() {
    recurringList.innerHTML = '<li>Carregando...</li>';
    try {
        const recurringTxs = await getRecurringTransactions(currentUser.uid);
        recurringList.innerHTML = '';

        if (recurringTxs.length === 0) {
            recurringList.innerHTML = '<li>Nenhuma transação recorrente cadastrada.</li>';
            return;
        }

        recurringTxs.forEach(tx => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.padding = '0.5rem';
            li.style.borderBottom = '1px solid var(--background-color)';
            li.classList.add(tx.type);

            const infoSpan = document.createElement('span');
            infoSpan.textContent = `Todo dia ${tx.dayOfMonth}: ${tx.description} (${formatCurrency(tx.amount)})`;

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '&times;';
            deleteButton.classList.add('action-btn', 'delete-btn');
            deleteButton.title = 'Excluir recorrência';
            deleteButton.onclick = async () => {
                if (confirm(`Tem certeza que deseja excluir a recorrência "${tx.description}"?`)) {
                    try {
                        await deleteRecurringTransaction(tx.id);
                        showNotification('Recorrência excluída com sucesso!');
                        renderRecurringList();
                    } catch (error) {
                        showNotification(error.message, 'error');
                    }
                }
            };

            li.appendChild(infoSpan);
            li.appendChild(deleteButton);
            recurringList.appendChild(li);
        });
    } catch (error) {
        showNotification(error.message, 'error');
        recurringList.innerHTML = '<li>Erro ao carregar recorrências.</li>';
    }
}

/** Busca os orçamentos do usuário e atualiza a UI. */
async function loadUserBudgets() {
    if (!currentUser) return;
    try {
        userBudgets = await getBudgets(currentUser.uid);
        renderBudgetList();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/** Renderiza a lista de orçamentos cadastrados. */
function renderBudgetList() {
    budgetList.innerHTML = '';
    if (userBudgets.length === 0) {
        budgetList.innerHTML = '<li>Nenhum orçamento definido.</li>';
        return;
    }

    userBudgets.forEach(budget => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '0.5rem';
        li.style.borderBottom = '1px solid var(--background-color)';

        const infoSpan = document.createElement('span');
        infoSpan.textContent = `${budget.category}: ${formatCurrency(budget.amount)}`;

        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '&times;';
        deleteButton.classList.add('action-btn', 'delete-btn');
        deleteButton.title = 'Excluir orçamento';
        deleteButton.onclick = async () => {
            if (confirm(`Tem certeza que deseja excluir o orçamento para "${budget.category}"?`)) {
                try {
                    await deleteBudget(budget.id);
                    showNotification('Orçamento excluído com sucesso!');
                    loadUserBudgets();
                } catch (error) {
                    showNotification(error.message, 'error');
                }
            }
        };
        li.appendChild(infoSpan);
        li.appendChild(deleteButton);
        budgetList.appendChild(li);
    });
}

/** Renderiza as barras de progresso dos orçamentos no dashboard. */
function renderBudgetProgress() {
    budgetProgressList.innerHTML = '';

    if (userBudgets.length === 0) {
        budgetProgressList.innerHTML = '<li>Nenhum orçamento definido. <a href="#" id="go-to-budgets">Definir agora</a></li>';
        document.getElementById('go-to-budgets').addEventListener('click', (e) => {
            e.preventDefault();
            openSettingsModal();
            document.querySelector('.tab-link[data-tab="budget-management-tab"]').click();
        });
        return;
    }

    userBudgets.forEach(budget => {
        const spentAmount = allTransactions
            .filter(t => t.type === 'expense' && t.category === budget.category)
            .reduce((sum, t) => sum + t.amount, 0);

        const percentage = (spentAmount / budget.amount) * 100;
        const cappedPercentage = Math.min(percentage, 100);

        let progressBarClass = 'safe';
        if (percentage > 90) {
            progressBarClass = 'danger';
        } else if (percentage > 70) {
            progressBarClass = 'warning';
        }

        const li = document.createElement('li');
        li.classList.add('budget-item');
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

// Funções de controle de visibilidade da UI
function showLoading() { loadingDiv.style.display = 'block'; authContainer.style.display = 'none'; appContainer.style.display = 'none'; }
function showAuthForms() { loadingDiv.style.display = 'none'; appContainer.style.display = 'none'; authContainer.style.display = 'block'; loginSection.style.display = 'block'; registerSection.style.display = 'none'; pendingApprovalSection.style.display = 'none';}
function showApp() { loadingDiv.style.display = 'none'; authContainer.style.display = 'none'; appContainer.style.display = 'block'; }
function showPendingApproval() { loadingDiv.style.display = 'none'; appContainer.style.display = 'none'; authContainer.style.display = 'block'; loginSection.style.display = 'none'; registerSection.style.display = 'none'; pendingApprovalSection.style.display = 'block'; }
function toggleAuthForms(showRegister) { if (showRegister) { loginSection.style.display = 'none'; registerSection.style.display = 'block'; } else { loginSection.style.display = 'block'; registerSection.style.display = 'none'; } }

// --- Lógica de Negócios e Eventos ---

showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(true); });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(false); });
logoutButton.addEventListener('click', () => { logoutUser().catch(error => showNotification(error.message, 'error')); });

logoutPendingButton.addEventListener('click', () => { logoutUser().catch(error => showNotification(error.message, 'error')); });
forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = prompt("Por favor, digite seu e-mail para enviarmos o link de redefinição de senha:");
    if (email) {
        try {
            await sendPasswordReset(email);
            showNotification(`Um e-mail de redefinição de senha foi enviado para ${email}.`);
        } catch (error) {
            showNotification("Erro ao enviar e-mail. Verifique se o e-mail está correto.", 'error');
        }
    }
});

closeButton.addEventListener('click', closeEditModal);
window.addEventListener('click', (event) => { if (event.target == editModal) { closeEditModal(); } });

manageCardsButton.addEventListener('click', openCardModal);
closeCardModalButton.addEventListener('click', closeCardModal);
window.addEventListener('click', (event) => { if (event.target == creditCardModal) { closeCardModal(); } });
backToCardsButton.addEventListener('click', showCardManagementView);

settingsButton.addEventListener('click', openSettingsModal);
closeSettingsModalButton.addEventListener('click', closeSettingsModal);
window.addEventListener('click', (event) => { if (event.target == settingsModal) { closeSettingsModal(); } });

tabLinks.forEach(button => {
    button.addEventListener('click', () => {
        const tabId = button.dataset.tab;

        tabLinks.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        button.classList.add('active');
        document.getElementById(tabId).classList.add('active');
    });
});

invoicePeriodSelect.addEventListener('change', (e) => {
    const selectedInvoiceId = e.target.value;
    const selectedInvoice = currentCardInvoices.find(inv => inv.id === selectedInvoiceId);
    if (selectedInvoice) {
        displayInvoiceDetails(selectedInvoice);
    }
});

payInvoiceButton.addEventListener('click', async () => {
    const selectedInvoiceId = invoicePeriodSelect.value;
    const selectedInvoice = currentCardInvoices.find(inv => inv.id === selectedInvoiceId);

    if (selectedInvoice && selectedCardForInvoiceView) {
        if (confirm(`Confirma o pagamento da fatura de ${formatCurrency(selectedInvoice.totalAmount)}?`)) {
            try {
                await payInvoice(selectedInvoice, selectedCardForInvoiceView);
                showNotification("Fatura paga com sucesso!");
                loadAndDisplayInvoices(selectedCardForInvoiceView);
                loadUserDashboard();
            } catch (error) {
                showNotification(error.message, 'error');
            }
        }
    }
});

filterMonthSelect.addEventListener('change', loadUserDashboard);
filterYearSelect.addEventListener('change', loadUserDashboard);
filterDescriptionInput.addEventListener('input', updateDashboard);
filterCategorySelect.addEventListener('change', updateDashboard);
filterPaymentMethodSelect.addEventListener('change', updateDashboard);

transactionTypeRadios.forEach(radio => { 
    radio.addEventListener('change', (e) => populateCategorySelects(e.target.value, transactionCategorySelect)); 
});
paymentMethodSelect.addEventListener('change', (e) => { creditCardWrapper.style.display = e.target.value === 'credit_card' ? 'block' : 'none'; });
editPaymentMethodSelect.addEventListener('change', (e) => { editCreditCardWrapper.style.display = e.target.value === 'credit_card' ? 'block' : 'none'; });

recurringTypeRadios.forEach(radio => {
    radio.addEventListener('change', e => populateCategorySelects(e.target.value, recurringCategorySelect));
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await loginUser(loginEmailInput.value, loginPasswordInput.value);
        loginForm.reset();
    } catch (error) {
        showNotification(error.message, 'error');
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await registerUser(registerEmailInput.value, registerPasswordInput.value);
        registerForm.reset();
        toggleAuthForms(false);
        showNotification("Cadastro realizado! Faça login para continuar.");
    } catch (error) {
        showNotification(error.message, 'error');
    }
});

addTransactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = addTransactionForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';

    if (!currentUser) {
        showNotification("Você precisa estar logado.", 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Adicionar';
        return;
    }
    
    const category = transactionCategorySelect.value;
    if (!category) {
        showNotification("Por favor, selecione uma categoria.", 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Adicionar';
        return;
    }

    const transactionData = {
        description: transactionDescriptionInput.value,
        amount: parseFloat(transactionAmountInput.value),
        date: transactionDateInput.value,
        type: document.querySelector('input[name="transaction-type"]:checked').value,
        category: category,
        paymentMethod: paymentMethodSelect.value,
        userId: currentUser.uid
    };

    let cardData = null;
    if (transactionData.paymentMethod === 'credit_card') {
        const cardId = creditCardSelect.value;
        if (!cardId || creditCardSelect.disabled) {
            showNotification("Por favor, selecione um cartão de crédito válido.", 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Adicionar';
            return;
        }
        transactionData.cardId = cardId;
        cardData = userCreditCards.find(card => card.id === cardId);
    }
    
    try {
        await addTransaction(transactionData, cardData);
        showNotification("Transação adicionada com sucesso!");
        addTransactionForm.reset();
        transactionDateInput.value = formatDateToInput(new Date());
        creditCardWrapper.style.display = 'none';
        
        if (transactionData.paymentMethod !== 'credit_card') {
            loadUserDashboard();
        }
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Adicionar';
    }
});

editTransactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = editTransactionForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';

    const transactionId = editTransactionIdInput.value;
    const updatedData = {
        description: editTransactionDescriptionInput.value,
        amount: parseFloat(editTransactionAmountInput.value),
        date: editTransactionDateInput.value,
        type: document.querySelector('input[name="edit-transaction-type"]:checked').value,
        category: editTransactionCategorySelect.value,
        paymentMethod: editPaymentMethodSelect.value,
    };
    try {
        await updateTransaction(transactionId, updatedData);
        showNotification('Transação atualizada com sucesso!');
        closeEditModal();
        loadUserDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar Alterações';
    }
});

addCreditCardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = addCreditCardForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Adicionando...';

    if (!currentUser) {
        showNotification("Você precisa estar logado.", 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Adicionar Cartão';
        return;
    }

    const cardData = {
        name: cardNameInput.value,
        closingDay: parseInt(cardClosingDayInput.value),
        dueDay: parseInt(cardDueDayInput.value),
        userId: currentUser.uid
    };

    try {
        await addCreditCard(cardData);
        showNotification("Cartão adicionado com sucesso!");
        addCreditCardForm.reset();
        await loadUserCreditCards();
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Adicionar Cartão';
    }
});

addCategoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = addCategoryForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const name = newCategoryNameInput.value.trim();
    if (!name) {
        showNotification("O nome da categoria não pode estar vazio.", "error");
        submitButton.disabled = false;
        return;
    }

    const type = document.querySelector('input[name="new-category-type"]:checked').value;

    try {
        await addCategory({
            name: name,
            type: type,
            userId: currentUser.uid
        });
        showNotification("Categoria adicionada com sucesso!");
        addCategoryForm.reset();
        await loadUserCategories();
    } catch (error) {
        showNotification(error.message, "error");
    } finally {
        submitButton.disabled = false;
    }
});

addRecurringForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = addRecurringForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const recurringData = {
        description: recurringDescriptionInput.value,
        amount: parseFloat(recurringAmountInput.value),
        dayOfMonth: parseInt(recurringDayInput.value),
        type: document.querySelector('input[name="recurring-type"]:checked').value,
        category: recurringCategorySelect.value,
        userId: currentUser.uid
    };

    if (!recurringData.category) {
        showNotification("Por favor, selecione uma categoria.", "error");
        submitButton.disabled = false;
        return;
    }

    try {
        await addRecurringTransaction(recurringData);
        showNotification("Recorrência adicionada com sucesso!");
        addRecurringForm.reset();
        renderRecurringList();
    } catch (error) {
        showNotification(error.message, "error");
    } finally {
        submitButton.disabled = false;
    }
});

setBudgetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = setBudgetForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const budgetData = {
        category: budgetCategorySelect.value,
        amount: parseFloat(budgetAmountInput.value),
        userId: currentUser.uid
    };

    if (!budgetData.category) {
        showNotification("Por favor, selecione uma categoria.", "error");
        submitButton.disabled = false;
        return;
    }
    if (isNaN(budgetData.amount) || budgetData.amount < 0) {
        showNotification("Por favor, insira um valor de orçamento válido.", "error");
        submitButton.disabled = false;
        return;
    }

    try {
        await setBudget(budgetData);
        showNotification(`Orçamento para "${budgetData.category}" salvo com sucesso!`);
        setBudgetForm.reset();
        loadUserBudgets();
    } catch (error) {
        showNotification(error.message, "error");
    } finally {
        submitButton.disabled = false;
    }
});

// --- Ponto de Entrada da Aplicação ---
function initializeApp() {
    showLoading();
    monitorAuthState(async (user) => {
        if (user) {
            currentUser = user;
            try {
                currentUserProfile = await getUserProfile(user.uid);
                if (currentUserProfile && currentUserProfile.status === 'approved') {
                    showApp();

                    if (currentUserProfile.role === 'admin') {
                        adminTabButton.style.display = 'block';
                    }

                    transactionDateInput.value = formatDateToInput(new Date());

                    const transactionsCreated = await processRecurringTransactions(user.uid);
                    if (transactionsCreated > 0) {
                        showNotification(`${transactionsCreated} transação(ões) recorrente(s) foram lançadas.`);
                    }

                    await closeOverdueInvoices(user.uid);
                    populateYearFilter();

                    await Promise.all([
                        loadUserDashboard(),
                        loadUserCreditCards(),
                        loadUserCategories(),
                        loadUserBudgets(),
                        getMonthlySummary(user.uid).then(renderTrendsChart)
                    ]);

                } else {
                    showPendingApproval();
                }
            } catch (error) {
                showNotification("Erro ao verificar seu perfil. Tente novamente.", "error");
                logoutUser();
            }
        } else {
            currentUser = null;
            currentUserProfile = null;
            userCreditCards = [];
            userCategories = [];
            userBudgets = [];
            allTransactions = [];
            showAuthForms();
        }
    });
}

initializeApp();
