// js/events.js

/**
 * Módulo para registrar e gerenciar todos os event listeners da aplicação.
 * Ele conecta as interações do usuário na UI com as funções de lógica de negócio e de renderização.
 */

// --- Módulos de Lógica e Estado ---
import * as state from './modules/state.js';
import * as auth from './modules/auth.js';
import * as transactions from './modules/transactions.js';
import * as categories from './modules/categories.js';
import * as creditCard from './modules/creditCard.js';
import * as invoices from './modules/invoices.js';
import * as budget from './modules/budget.js';
import * as recurring from './modules/recurring.js';
import * as admin from './modules/admin.js';
import * as app from './app.js';

// --- Módulos de UI ---
import * as views from './modules/ui/views.js';
import * as modals from './modules/ui/modals.js';
import * as render from './modules/ui/render.js';
import { showNotification } from './modules/ui/notifications.js';

// --- Seleção de Elementos do DOM ---
const loginForm = document.querySelector('#login-form form');
const registerForm = document.querySelector('#register-form form');
const addTransactionForm = document.getElementById('add-transaction-form');
const editTransactionForm = document.getElementById('edit-transaction-form');
const addCreditCardForm = document.getElementById('add-credit-card-form');
const addCategoryForm = document.getElementById('add-category-form');
const setBudgetForm = document.getElementById('set-budget-form');
const addRecurringForm = document.getElementById('add-recurring-form');
const editRecurringForm = document.getElementById('edit-recurring-form');
const themeToggle = document.getElementById('theme-toggle');

/**
 * Função principal que inicializa todos os event listeners da aplicação.
 * Será chamada uma única vez quando a aplicação iniciar.
 */
export function initializeEventListeners() {

    // --- Listeners de Autenticação ---
    document.getElementById('show-register-link').addEventListener('click', (e) => { e.preventDefault(); views.toggleAuthForms(true); });
    document.getElementById('show-login-link').addEventListener('click', (e) => { e.preventDefault(); views.toggleAuthForms(false); });
    document.getElementById('logout-button').addEventListener('click', () => { auth.logoutUser().catch(err => showNotification(err.message, 'error')); });
    document.getElementById('logout-pending-button').addEventListener('click', () => { auth.logoutUser().catch(err => showNotification(err.message, 'error')); });
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await auth.loginUser(e.target['login-email'].value, e.target['login-password'].value);
            loginForm.reset();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await auth.registerUser(e.target['register-email'].value, e.target['register-password'].value);
            registerForm.reset();
            views.toggleAuthForms(false);
            showNotification("Cadastro realizado! Faça login para continuar.");
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });
    
    document.getElementById('forgot-password-link').addEventListener('click', async (e) => {
        e.preventDefault();
        const email = prompt("Por favor, digite seu e-mail para o link de redefinição de senha:");
        if (email) {
            try {
                await auth.sendPasswordReset(email);
                showNotification(`E-mail de redefinição enviado para ${email}.`);
            } catch (error) {
                showNotification("Erro ao enviar e-mail. Verifique o endereço.", 'error');
            }
        }
    });


    // --- Listeners do Formulário Principal de Transações ---
    addTransactionForm.addEventListener('submit', handleAddTransaction);
    document.querySelectorAll('input[name="transaction-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => render.populateCategorySelects(e.target.value, document.getElementById('transaction-category')));
    });

    // INÍCIO DA ALTERAÇÃO - Lógica de visibilidade para campos de cartão e parcelamento
    document.getElementById('payment-method').addEventListener('change', (e) => {
        const creditCardWrapper = document.getElementById('credit-card-wrapper');
        const installmentOptionsWrapper = document.getElementById('installment-options-wrapper');
        if (e.target.value === 'credit_card') {
            creditCardWrapper.style.display = 'block';
            installmentOptionsWrapper.style.display = 'block';
        } else {
            creditCardWrapper.style.display = 'none';
            installmentOptionsWrapper.style.display = 'none';
        }
    });

    document.getElementById('is-installment-checkbox').addEventListener('change', (e) => {
        const installmentsCountWrapper = document.getElementById('installments-count-wrapper');
        const amountLabel = document.getElementById('transaction-amount-label');
        if (e.target.checked) {
            installmentsCountWrapper.style.display = 'block';
            amountLabel.textContent = 'Valor Total (R$)';
        } else {
            installmentsCountWrapper.style.display = 'none';
            amountLabel.textContent = 'Valor (R$)';
        }
    });
    // FIM DA ALTERAÇÃO


    // --- Listeners dos Filtros do Histórico ---
    document.getElementById('filter-month').addEventListener('change', app.loadUserDashboard);
    document.getElementById('filter-year').addEventListener('change', app.loadUserDashboard);
    document.getElementById('filter-description').addEventListener('input', app.applyFiltersAndUpdateDashboard);
    document.getElementById('filter-category').addEventListener('change', app.applyFiltersAndUpdateDashboard);
    document.getElementById('filter-payment-method').addEventListener('change', app.applyFiltersAndUpdateDashboard);

    // --- Listener do botão de Exportar ---
    document.getElementById('export-csv-button').addEventListener('click', handleExportCsv);


    // --- Listeners de Abertura de Modais ---
    document.getElementById('settings-button').addEventListener('click', modals.openSettingsModal);
    document.getElementById('manage-cards-button').addEventListener('click', modals.openCardModal);


    // --- Delegação de Eventos para a Lista de Transações ---
    document.getElementById('transactions-list').addEventListener('click', (e) => {
        const target = e.target;
        const transactionLi = target.closest('li');
        if (!transactionLi || !transactionLi.dataset.id) return;

        const transactionId = transactionLi.dataset.id;

        if (target.matches('.edit-btn')) {
            const transaction = state.filteredTransactions.find(t => t.id === transactionId);
            if (transaction) modals.openEditModal(transaction);
        }
        if (target.matches('.delete-btn')) {
            handleDeleteTransaction(transactionId);
        }
    });


    // --- Listeners do Modal de Edição de Transação ---
    editTransactionForm.addEventListener('submit', handleUpdateTransaction);
    document.getElementById('edit-payment-method').addEventListener('change', (e) => {
        document.getElementById('edit-credit-card-wrapper').style.display = e.target.value === 'credit_card' ? 'block' : 'none';
    });
    document.querySelector('.close-button').addEventListener('click', modals.closeEditModal);


    // --- Listeners do Modal de Cartões de Crédito ---
    document.querySelector('.close-card-modal-button').addEventListener('click', modals.closeCardModal);
    document.getElementById('back-to-cards-button').addEventListener('click', modals.showCardManagementView);
    addCreditCardForm.addEventListener('submit', handleAddCreditCard);
    
    document.getElementById('credit-card-list').addEventListener('click', (e) => {
        const eventTarget = e.target.closest('[data-card-id]');
        if (!eventTarget) return;

        const cardId = eventTarget.dataset.cardId;
        
        if (eventTarget.matches('.card-info')) {
            const card = state.userCreditCards.find(c => c.id === cardId);
            if(card) modals.showInvoiceDetailsView(card);
        }
        if (eventTarget.matches('.delete-btn')) {
            handleDeleteCreditCard(cardId);
        }
    });

    document.getElementById('invoice-period-select').addEventListener('change', (e) => {
        const selectedInvoice = state.currentCardInvoices.find(inv => inv.id === e.target.value);
        if (selectedInvoice) modals.displayInvoiceDetails(selectedInvoice);
    });

    document.getElementById('pay-invoice-button').addEventListener('click', handlePayInvoice);


    // --- Listeners do Modal de Configurações ---
    document.querySelector('.close-settings-modal-button').addEventListener('click', modals.closeSettingsModal);
    themeToggle.addEventListener('change', () => app.toggleTheme(themeToggle.checked));
    
    document.querySelector('.modal-tabs').addEventListener('click', (e) => {
        if (e.target.matches('.tab-link')) {
            const tabId = e.target.dataset.tab;
            document.querySelectorAll('.tab-link').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        }
    });

    addCategoryForm.addEventListener('submit', handleAddCategory);
    document.getElementById('category-lists-container').addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.delete-btn[data-category-id]');
        if (deleteButton) {
            const categoryId = deleteButton.dataset.categoryId;
            handleDeleteCategory(categoryId);
        }
    });

    setBudgetForm.addEventListener('submit', handleSetBudget);
    document.getElementById('budget-list').addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.delete-btn[data-budget-id]');
        if (deleteButton) {
            const budgetId = deleteButton.dataset.budgetId;
            handleDeleteBudget(budgetId);
        }
    });

    addRecurringForm.addEventListener('submit', handleAddRecurring);
    document.querySelectorAll('input[name="recurring-type"]').forEach(radio => {
        radio.addEventListener('change', e => render.populateCategorySelects(e.target.value, document.getElementById('recurring-category')));
    });
    
    document.getElementById('recurring-list').addEventListener('click', (e) => {
        const eventTarget = e.target.closest('.action-btn[data-recurring-id]');
        if (!eventTarget) return;

        const recurringId = eventTarget.dataset.recurringId;
        const recurringTx = state.userRecurringTransactions.find(tx => tx.id === recurringId);
        
        if (eventTarget.matches('.edit-btn')) {
            if (recurringTx) modals.openEditRecurringModal(recurringTx);
        }
        if (eventTarget.matches('.delete-btn')) {
            if (recurringTx) handleDeleteRecurring(recurringTx);
        }
    });

    document.getElementById('user-list').addEventListener('click', async (e) => {
        const approveButton = e.target.closest('.approve-user-btn[data-user-id]');
        if (approveButton) {
            const userId = approveButton.dataset.userId;
            if (confirm('Aprovar este usuário?')) {
                try {
                    await admin.updateUserStatus(userId, 'approved');
                    showNotification('Usuário aprovado com sucesso!');
                    const users = await admin.getAllUsers();
                    render.renderUserList(users);
                } catch (error) {
                    showNotification(error.message, 'error');
                }
            }
        }
    });
    
    document.querySelector('.close-edit-recurring-modal-button').addEventListener('click', modals.closeEditRecurringModal);
    editRecurringForm.addEventListener('submit', handleUpdateRecurring);
    

    // --- Listener Global para fechar modais clicando fora ---
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}


// --- Funções "Handler" para Lógica de Eventos ---

// INÍCIO DA ALTERAÇÃO - Atualiza o handler para coletar dados de parcelamento
async function handleAddTransaction(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const category = form['transaction-category'].value;
    if (!category) {
        showNotification("Por favor, selecione uma categoria.", 'error');
        submitButton.disabled = false;
        return;
    }

    const transactionData = {
        description: form['transaction-description'].value,
        amount: parseFloat(form['transaction-amount'].value),
        date: form['transaction-date'].value,
        type: form['transaction-type'].value,
        category: category,
        paymentMethod: form['payment-method'].value,
        userId: state.currentUser.uid,
        isInstallment: false
    };

    let cardData = null;
    if (transactionData.paymentMethod === 'credit_card') {
        const cardId = form['credit-card-select'].value;
        if (!cardId) {
            showNotification("Por favor, selecione um cartão de crédito.", 'error');
            submitButton.disabled = false;
            return;
        }
        transactionData.cardId = cardId;
        cardData = state.userCreditCards.find(card => card.id === cardId);

        const isInstallment = form['is-installment-checkbox'].checked;
        if (isInstallment) {
            transactionData.isInstallment = true;
            transactionData.installments = parseInt(form['installments-count'].value);
            if (isNaN(transactionData.installments) || transactionData.installments < 2) {
                showNotification("O número de parcelas deve ser 2 ou maior.", 'error');
                submitButton.disabled = false;
                return;
            }
        }
    }
    
    try {
        await transactions.addTransaction(transactionData, cardData);
        showNotification("Transação adicionada com sucesso!");
        form.reset();
        // Reseta a UI de parcelamento para o estado padrão
        document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('credit-card-wrapper').style.display = 'none';
        document.getElementById('installment-options-wrapper').style.display = 'none';
        document.getElementById('installments-count-wrapper').style.display = 'none';
        document.getElementById('transaction-amount-label').textContent = 'Valor (R$)';
        
        if (transactionData.paymentMethod !== 'credit_card') {
            app.loadUserDashboard();
        }
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}
// FIM DA ALTERAÇÃO

async function handleDeleteTransaction(transactionId) {
    const tx = state.filteredTransactions.find(t => t.id === transactionId);
    if (confirm(`Tem certeza que deseja excluir a transação "${tx.description}"?`)) {
        try {
            await transactions.deleteTransaction(transactionId);
            showNotification('Transação excluída com sucesso!');
            app.loadUserDashboard();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

async function handleUpdateTransaction(e) {
    e.preventDefault();
    const form = e.target;
    const transactionId = form['edit-transaction-id'].value;
    const updatedData = {
        description: form['edit-transaction-description'].value,
        amount: parseFloat(form['edit-transaction-amount'].value),
        date: form['edit-transaction-date'].value,
        type: form['edit-transaction-type'].value,
        category: form['edit-transaction-category'].value,
        paymentMethod: form['edit-payment-method'].value,
    };
    try {
        await transactions.updateTransaction(transactionId, updatedData);
        showNotification('Transação atualizada com sucesso!');
        modals.closeEditModal();
        app.loadUserDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleAddCreditCard(e) {
    e.preventDefault();
    const form = e.target;
    const cardData = {
        name: form['card-name'].value,
        closingDay: parseInt(form['card-closing-day'].value),
        dueDay: parseInt(form['card-due-day'].value),
        userId: state.currentUser.uid
    };
    try {
        await creditCard.addCreditCard(cardData);
        showNotification("Cartão adicionado com sucesso!");
        form.reset();
        app.loadUserCreditCards();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleDeleteCreditCard(cardId) {
    const card = state.userCreditCards.find(c => c.id === cardId);
    if (confirm(`Tem certeza de que deseja excluir o cartão "${card.name}"?`)) {
        try {
            await creditCard.deleteCreditCard(cardId);
            showNotification('Cartão excluído com sucesso!');
            app.loadUserCreditCards();
            if (state.selectedCardForInvoiceView && state.selectedCardForInvoiceView.id === cardId) {
                modals.showCardManagementView();
            }
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

async function handlePayInvoice() {
    const selectedInvoice = state.currentCardInvoices.find(inv => inv.id === document.getElementById('invoice-period-select').value);
    if (selectedInvoice && state.selectedCardForInvoiceView) {
        if (confirm(`Confirma o pagamento da fatura de ${formatCurrency(selectedInvoice.totalAmount)}?`)) {
            try {
                await invoices.payInvoice(selectedInvoice, state.selectedCardForInvoiceView);
                showNotification("Fatura paga com sucesso!");
                modals.loadAndDisplayInvoices(state.selectedCardForInvoiceView);
                app.loadUserDashboard();
            } catch (error) {
                showNotification(error.message, 'error');
            }
        }
    }
}

async function handleAddCategory(e) {
    e.preventDefault();
    const form = e.target;
    const categoryData = {
        name: form['new-category-name'].value.trim(),
        type: form['new-category-type'].value,
        userId: state.currentUser.uid
    };
    if (!categoryData.name) {
        showNotification("O nome da categoria não pode estar vazio.", "error");
        return;
    }
    try {
        await categories.addCategory(categoryData);
        showNotification("Categoria adicionada com sucesso!");
        form.reset();
        app.loadUserCategories();
    } catch (error) {
        showNotification(error.message, "error");
    }
}

async function handleDeleteCategory(categoryId) {
    const cat = state.userCategories.find(c => c.id === categoryId);
    if (confirm(`Tem certeza de que deseja excluir a categoria "${cat.name}"?`)) {
        try {
            await categories.deleteCategory(categoryId);
            showNotification("Categoria excluída com sucesso!");
            app.loadUserCategories();
        } catch (error) {
            showNotification(error.message, "error");
        }
    }
}

async function handleSetBudget(e) {
    e.preventDefault();
    const form = e.target;
    const budgetData = {
        category: form['budget-category'].value,
        amount: parseFloat(form['budget-amount'].value),
        userId: state.currentUser.uid
    };
    if (!budgetData.category || isNaN(budgetData.amount) || budgetData.amount <= 0) {
        showNotification("Por favor, selecione uma categoria e insira um valor válido.", "error");
        return;
    }
    try {
        await budget.setBudget(budgetData);
        showNotification(`Orçamento para "${budgetData.category}" salvo!`);
        form.reset();
        app.loadUserBudgets();
    } catch (error) {
        showNotification(error.message, "error");
    }
}

async function handleDeleteBudget(budgetId) {
    const bud = state.userBudgets.find(b => b.id === budgetId);
     if (confirm(`Excluir o orçamento para "${bud.category}"?`)) {
        try {
            await budget.deleteBudget(budgetId);
            showNotification("Orçamento excluído!");
            app.loadUserBudgets();
        } catch (error) {
            showNotification(error.message, "error");
        }
    }
}

async function handleAddRecurring(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const recurringData = {
        description: form['recurring-description'].value,
        amount: parseFloat(form['recurring-amount'].value),
        dayOfMonth: parseInt(form['recurring-day'].value),
        type: form['recurring-type'].value,
        category: form['recurring-category'].value,
        userId: state.currentUser.uid
    };

    try {
        await recurring.addRecurringTransaction(recurringData);
        showNotification("Recorrência adicionada com sucesso!");
        form.reset();
        const recurringTxs = await recurring.getRecurringTransactions(state.currentUser.uid);
        state.setUserRecurringTransactions(recurringTxs);
        render.renderRecurringList();
    } catch (error) {
        showNotification(error.message, "error");
    } finally {
        submitButton.disabled = false;
    }
}

async function handleUpdateRecurring(e) {
    e.preventDefault();
    const form = e.target;
    const recurringId = form['edit-recurring-id'].value;
    const updatedData = {
        description: form['edit-recurring-description'].value,
        amount: parseFloat(form['edit-recurring-amount'].value),
        dayOfMonth: parseInt(form['edit-recurring-day'].value),
        type: form['edit-recurring-type'].value,
        category: form['edit-recurring-category'].value,
    };

    try {
        await recurring.updateRecurringTransaction(recurringId, updatedData);
        showNotification('Recorrência atualizada com sucesso!');
        modals.closeEditRecurringModal();
        
        const recurringTxs = await recurring.getRecurringTransactions(state.currentUser.uid);
        state.setUserRecurringTransactions(recurringTxs);
        render.renderRecurringList();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleDeleteRecurring(recurringTx) {
    if (confirm(`Tem certeza que deseja excluir a recorrência "${recurringTx.description}"?`)) {
        try {
            await recurring.deleteRecurringTransaction(recurringTx.id);
            showNotification('Recorrência excluída com sucesso!');
            
            const recurringTxs = await recurring.getRecurringTransactions(state.currentUser.uid);
            state.setUserRecurringTransactions(recurringTxs);
            render.renderRecurringList();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

function handleExportCsv() {
    if (state.filteredTransactions.length === 0) {
        showNotification("Nenhuma transação para exportar.", "error");
        return;
    }

    const headers = ['Data', 'Descrição', 'Valor', 'Tipo', 'Categoria', 'Método de Pagamento'];
    const csvRows = state.filteredTransactions.map(t => {
        const row = [
            t.date.toLocaleDateString('pt-BR'),
            `"${t.description.replace(/"/g, '""')}"`,
            t.amount.toFixed(2).replace('.', ','),
            t.type === 'revenue' ? 'Receita' : 'Despesa',
            t.category,
            t.paymentMethod
        ];
        return row.join(';');
    });

    const csvContent = [headers.join(';'), ...csvRows].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `transacoes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
