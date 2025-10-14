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
import { getDescriptionSuggestions } from './modules/autocomplete.js';

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
const editInvoiceTransactionForm = document.getElementById('edit-invoice-transaction-form');
const themeToggle = document.getElementById('theme-toggle');

let debounceTimer;

/**
 * Função principal que inicializa todos os event listeners da aplicação.
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
        radio.addEventListener('change', (e) => {
            render.populateCategorySelects(e.target.value, document.getElementById('transaction-category'));
            // Esconde o campo de subcategoria ao trocar o tipo
            document.getElementById('transaction-subcategory-wrapper').style.display = 'none';
        });
    });

    document.getElementById('transaction-description').addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            handleDescriptionAutocomplete(e.target.value);
        }, 300);
    });

    // INÍCIO DA ALTERAÇÃO - Lógica para subcategorias no formulário de transação
    document.getElementById('transaction-category').addEventListener('change', (e) => {
        const subcategoryWrapper = document.getElementById('transaction-subcategory-wrapper');
        const subcategoryDatalist = document.getElementById('subcategory-suggestions');
        const selectedOption = e.target.options[e.target.selectedIndex];
        const categoryId = selectedOption.dataset.categoryId;

        if (!categoryId) {
            subcategoryWrapper.style.display = 'none';
            return;
        }

        const category = state.userCategories.find(c => c.id === categoryId);
        subcategoryWrapper.style.display = 'block';
        subcategoryDatalist.innerHTML = '';

        if (category && category.subcategories && category.subcategories.length > 0) {
            category.subcategories.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub;
                subcategoryDatalist.appendChild(option);
            });
        }
    });
    // FIM DA ALTERAÇÃO

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


    // --- Listeners dos Filtros do Histórico ---
    document.getElementById('filter-month').addEventListener('change', app.loadUserDashboard);
    document.getElementById('filter-year').addEventListener('change', app.loadUserDashboard);
    document.getElementById('filter-description').addEventListener('input', app.applyFiltersAndUpdateDashboard);
    document.getElementById('filter-category').addEventListener('change', app.applyFiltersAndUpdateDashboard);
    document.getElementById('filter-payment-method').addEventListener('change', app.applyFiltersAndUpdateDashboard);

    document.getElementById('export-csv-button').addEventListener('click', handleExportCsv);
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

    // --- Listeners de Modais ---
    editTransactionForm.addEventListener('submit', handleUpdateTransaction);
    document.querySelector('.close-button').addEventListener('click', modals.closeEditModal);

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

    document.getElementById('invoice-period-select').addEventListener('change', async (e) => {
        const selectedInvoice = state.currentCardInvoices.find(inv => inv.id === e.target.value);
        if (selectedInvoice) await modals.displayInvoiceDetails(selectedInvoice);
    });

    document.getElementById('pay-invoice-button').addEventListener('click', handlePayInvoice);

    document.getElementById('invoice-transactions-list').addEventListener('click', (e) => {
        const eventTarget = e.target.closest('.action-btn[data-invoice-tx-id]');
        if (!eventTarget) return;
        const transactionId = eventTarget.dataset.invoiceTxId;
        if (eventTarget.matches('.edit-btn')) {
            modals.openEditInvoiceTransactionModal(transactionId);
        }
        if (eventTarget.matches('.delete-btn')) {
            showNotification('A exclusão de lançamentos individuais da fatura será implementada em breve.', 'error');
        }
    });

    document.querySelector('.close-edit-invoice-tx-modal-button').addEventListener('click', modals.closeEditInvoiceTransactionModal);
    editInvoiceTransactionForm.addEventListener('submit', handleUpdateInvoiceTransaction);

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
    setBudgetForm.addEventListener('submit', handleSetBudget);
    addRecurringForm.addEventListener('submit', handleAddRecurring);

    // INÍCIO DA ALTERAÇÃO - Nova delegação de eventos para o gerenciamento de categorias
    const categoryContainer = document.getElementById('category-lists-container');
    categoryContainer.addEventListener('click', (e) => {
        const target = e.target;
        const categoryItem = target.closest('.category-item');
        if (!categoryItem) return;

        const categoryId = categoryItem.dataset.categoryId;

        // Ação: Expandir/Recolher subcategorias
        if (target.matches('.toggle-subcategories-btn')) {
            const subcontainer = categoryItem.querySelector('.subcategory-container');
            const isHidden = subcontainer.style.display === 'none';
            subcontainer.style.display = isHidden ? 'block' : 'none';
            target.innerHTML = isHidden ? '&#9652;' : '&#9662;'; // Seta para cima/baixo
        }

        // Ação: Excluir categoria principal
        if (target.matches('.delete-category-btn')) {
            handleDeleteCategory(categoryId);
        }

        // Ação: Excluir subcategoria
        if (target.matches('.delete-subcategory-btn')) {
            const subcategoryName = target.dataset.subcategoryName;
            handleDeleteSubcategory(categoryId, subcategoryName);
        }
    });

    categoryContainer.addEventListener('submit', (e) => {
        // Ação: Adicionar nova subcategoria
        if (e.target.matches('.add-subcategory-form')) {
            e.preventDefault();
            const form = e.target;
            const categoryItem = form.closest('.category-item');
            const categoryId = categoryItem.dataset.categoryId;
            const subcategoryName = form.querySelector('.new-subcategory-name').value;
            handleAddSubcategory(categoryId, subcategoryName, form);
        }
    });
    // FIM DA ALTERAÇÃO
    
    document.getElementById('budget-list').addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.delete-btn[data-budget-id]');
        if (deleteButton) {
            const budgetId = deleteButton.dataset.budgetId;
            handleDeleteBudget(budgetId);
        }
    });
    
    document.getElementById('recurring-list').addEventListener('click', (e) => {
        const eventTarget = e.target.closest('.action-btn[data-recurring-id]');
        if (!eventTarget) return;
        const recurringId = eventTarget.dataset.recurringId;
        const recurringTx = state.userRecurringTransactions.find(tx => tx.id === recurringId);
        if (eventTarget.matches('.edit-btn') && recurringTx) modals.openEditRecurringModal(recurringTx);
        if (eventTarget.matches('.delete-btn') && recurringTx) handleDeleteRecurring(recurringTx);
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
    
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) event.target.style.display = 'none';
    });
}


// --- Funções "Handler" para Lógica de Eventos ---

async function handleDescriptionAutocomplete(searchTerm) {
    const datalist = document.getElementById('description-suggestions');
    if (!state.currentUser || !datalist) return;
    const suggestions = await getDescriptionSuggestions(state.currentUser.uid, searchTerm);
    datalist.innerHTML = '';
    suggestions.forEach(suggestionText => {
        const option = document.createElement('option');
        option.value = suggestionText;
        datalist.appendChild(option);
    });
}

async function handleAddTransaction(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    // INÍCIO DA ALTERAÇÃO - Coleta de dados da subcategoria
    const categorySelect = form['transaction-category'];
    const selectedCategoryOption = categorySelect.options[categorySelect.selectedIndex];
    const categoryName = selectedCategoryOption.value;
    const categoryId = selectedCategoryOption.dataset.categoryId;
    const subcategoryName = form['transaction-subcategory'].value.trim();
    // FIM DA ALTERAÇÃO

    if (!categoryName) {
        showNotification("Por favor, selecione uma categoria.", 'error');
        submitButton.disabled = false;
        return;
    }

    const transactionData = {
        description: form['transaction-description'].value,
        amount: parseFloat(form['transaction-amount'].value),
        date: form['transaction-date'].value,
        type: form['transaction-type'].value,
        category: categoryName,
        categoryId: categoryId, // Passa o ID para o backend
        subcategory: subcategoryName, // Passa a subcategoria
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
        document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('credit-card-wrapper').style.display = 'none';
        document.getElementById('installment-options-wrapper').style.display = 'none';
        document.getElementById('installments-count-wrapper').style.display = 'none';
        document.getElementById('transaction-amount-label').textContent = 'Valor (R$)';
        document.getElementById('transaction-subcategory-wrapper').style.display = 'none';
        
        if (transactionData.paymentMethod !== 'credit_card') {
            app.loadUserDashboard();
        }
        // Se uma nova subcategoria foi criada, recarrega os dados de categorias
        if (subcategoryName) {
            app.loadUserCategories();
        }
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

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

async function handleUpdateInvoiceTransaction(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const transactionId = form['edit-invoice-transaction-id'].value;
        const originalInvoiceId = form['edit-invoice-id'].value;
        const cardId = form['edit-invoice-card-id'].value;
        const updatedData = {
            description: form['edit-invoice-tx-description'].value,
            amount: parseFloat(form['edit-invoice-tx-amount'].value),
            purchaseDate: form['edit-invoice-tx-date'].value,
            category: form['edit-invoice-tx-category'].value,
        };
        const card = state.userCreditCards.find(c => c.id === cardId);
        if (!card) throw new Error("Cartão de crédito não encontrado.");
        await invoices.updateInvoiceTransaction(originalInvoiceId, transactionId, updatedData, card);
        showNotification('Lançamento atualizado com sucesso!');
        modals.closeEditInvoiceTransactionModal();
        await modals.loadAndDisplayInvoices(card);
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
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
                await modals.loadAndDisplayInvoices(state.selectedCardForInvoiceView);
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
    if (confirm(`Tem certeza de que deseja excluir a categoria "${cat.name}"? Todas as suas subcategorias também serão removidas.`)) {
        try {
            await categories.deleteCategory(categoryId);
            showNotification("Categoria excluída com sucesso!");
            app.loadUserCategories();
        } catch (error) {
            showNotification(error.message, "error");
        }
    }
}

// INÍCIO DA ALTERAÇÃO - Novos handlers para subcategorias
async function handleAddSubcategory(categoryId, subcategoryName, form) {
    if (!subcategoryName.trim()) {
        showNotification("O nome da subcategoria não pode estar vazio.", "error");
        return;
    }
    try {
        await categories.addSubcategory(categoryId, subcategoryName);
        showNotification("Subcategoria adicionada com sucesso!");
        form.reset();
        await app.loadUserCategories(); // Recarrega e re-renderiza a lista
    } catch (error) {
        showNotification(error.message, "error");
    }
}

async function handleDeleteSubcategory(categoryId, subcategoryName) {
    if (confirm(`Tem certeza de que deseja excluir a subcategoria "${subcategoryName}"?`)) {
        try {
            await categories.deleteSubcategory(categoryId, subcategoryName);
            showNotification("Subcategoria excluída com sucesso!");
            await app.loadUserCategories();
        } catch (error) {
            showNotification(error.message, "error");
        }
    }
}
// FIM DA ALTERAÇÃO

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
