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
import * as accounts from './modules/accounts.js'; 
import * as transfers from './modules/transfers.js';
import { getDescriptionSuggestions } from './modules/autocomplete.js';
import * as investmentsUI from './modules/investments/ui.js';
import * as movements from './modules/investments/movements.js';


// --- Módulos de UI ---
import * as views from './modules/ui/views.js';
import * as modals from './modules/ui/modals.js';
import * as render from './modules/ui/render.js';
import { showNotification } from './modules/ui/notifications.js';
import * as proventosUI from './modules/proventos/ui.js';
import * as transactionsInvestmentUI from './modules/transactions-investment/ui.js';

// --- Seleção de Elementos do DOM ---
const loginForm = document.querySelector('#login-form form');
const registerForm = document.querySelector('#register-form form');
const addTransactionForm = document.getElementById('add-transaction-form');
const addTransferForm = document.getElementById('add-transfer-form');
const editTransactionForm = document.getElementById('edit-transaction-form');
const addCreditCardForm = document.getElementById('add-credit-card-form');
const editCreditCardForm = document.getElementById('edit-credit-card-form');
const addCategoryForm = document.getElementById('add-category-form');
const setBudgetForm = document.getElementById('set-budget-form');
const addRecurringForm = document.getElementById('add-recurring-form');
const editRecurringForm = document.getElementById('edit-recurring-form');
const editInvoiceTransactionForm = document.getElementById('edit-invoice-transaction-form');
const themeToggle = document.getElementById('theme-toggle');
const addAccountForm = document.getElementById('add-account-form');
const appContent = document.getElementById('app-content');
const payInvoiceForm = document.getElementById('pay-invoice-form');
const advancePaymentForm = document.getElementById('advance-payment-form');
const editTransferForm = document.getElementById('edit-transfer-form');
const splitTransactionButton = document.getElementById('split-transaction-button');
const addSplitForm = document.getElementById('add-split-form');
const splitList = document.getElementById('split-list');
const confirmSplitButton = document.getElementById('confirm-split-button');
const portfolioFilterSelect = document.getElementById('portfolio-filter-select');
const backToInvestmentDashboardBtn = document.getElementById('back-to-investment-dashboard-btn');
const goToPortfoliosManagementBtn = document.getElementById('go-to-portfolios-management-btn');
const transactionsInvestmentList = document.getElementById('transactions-investment-list');


// Formulários de Edição de Investimentos
const editPortfolioForm = document.getElementById('edit-portfolio-form');
const editAssetForm = document.getElementById('edit-asset-form');
const editMovementForm = document.getElementById('edit-movement-form');


let debounceTimer;
let isTransactionSplit = false;

/**
 * Função principal que inicializa todos os event listeners da aplicação.
 */
export function initializeEventListeners() {

    // --- Listeners de Autenticação ---
    document.getElementById('show-register-link').addEventListener('click', (e) => { e.preventDefault(); views.toggleAuthForms(true); });
    document.getElementById('show-login-link').addEventListener('click', (e) => { e.preventDefault(); views.toggleAuthForms(false); });
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

    // Listeners de Navegação Principal (Cabeçalho)
    document.getElementById('nav-dashboard-button').addEventListener('click', (e) => {
        e.preventDefault();
        views.showDashboardView();
    });

    document.getElementById('nav-investments-button').addEventListener('click', async (e) => {
        e.preventDefault();
        views.showInvestmentsView();
        await investmentsUI.loadInvestmentDashboard();
    });

    document.getElementById('nav-proventos-button').addEventListener('click', async (e) => {
        e.preventDefault();
        views.showProventosView();
        await proventosUI.loadProventosPage(); 
    });

    document.getElementById('nav-transactions-investment-button').addEventListener('click', async (e) => {
        e.preventDefault();
        views.showTransactionsInvestmentView();
        await transactionsInvestmentUI.loadTransactionsPage(); 
    });

    document.getElementById('nav-cards-button').addEventListener('click', (e) => {
        e.preventDefault();
        modals.openCardModal();
    });

    document.getElementById('nav-management-button').addEventListener('click', (e) => {
        e.preventDefault();
        modals.openManagementModal();
    });

    document.getElementById('nav-settings-button').addEventListener('click', (e) => {
        e.preventDefault();
        modals.openSettingsModal();
    });
    
    document.getElementById('nav-logout-button').addEventListener('click', (e) => {
        e.preventDefault();
        auth.logoutUser().catch(err => showNotification(err.message, 'error'));
    });


    // --- Lógica de UI do Dashboard ---
    appContent.addEventListener('click', (e) => {
        const sectionHeader = e.target.closest('.section-header');
        if (sectionHeader) {
            if (sectionHeader.parentElement.classList.contains('dragging')) return;
            app.toggleSection(sectionHeader);
        }
    });
    
    let draggingElement = null;

    appContent.addEventListener('dragstart', (e) => {
        const target = e.target.closest('.dashboard-section');
        if (target && e.target.closest('.section-header')) {
            draggingElement = target;
            setTimeout(() => {
                target.classList.add('dragging');
            }, 0);
        } else {
            e.preventDefault();
        }
    });

    appContent.addEventListener('dragend', () => {
        if (draggingElement) {
            draggingElement.classList.remove('dragging');
            draggingElement = null;
            
            const sections = appContent.querySelectorAll('.dashboard-section');
            const newOrder = Array.from(sections).map(section => section.dataset.sectionId);
            app.saveDashboardOrder(newOrder);
        }
    });

    appContent.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggingElement) return;

        const afterElement = getDragAfterElement(appContent, e.clientY);
        if (afterElement == null) {
            appContent.appendChild(draggingElement);
        } else {
            appContent.insertBefore(draggingElement, afterElement);
        }
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.dashboard-section:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    document.querySelector('.form-tabs').addEventListener('click', (e) => {
        if (e.target.matches('.tab-link')) {
            const formId = e.target.dataset.form;
            
            document.querySelectorAll('.form-tabs .tab-link').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            document.querySelectorAll('.form-section').forEach(form => form.style.display = 'none');
            document.getElementById(formId).style.display = 'block';
        }
    });


    // --- Listeners do Formulário Principal de Transações ---
    addTransactionForm.addEventListener('submit', handleAddTransaction);
    addTransferForm.addEventListener('submit', handleAddTransfer);
    
    document.querySelectorAll('input[name="transaction-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const type = e.target.value;
            render.populateCategorySelects(type, document.getElementById('transaction-category'));
            document.getElementById('transaction-subcategory-wrapper').style.display = 'none';

            if (type === 'expense') {
                splitTransactionButton.style.display = 'inline';
            } else {
                splitTransactionButton.style.display = 'none';
                if (isTransactionSplit) {
                    resetSplitState();
                }
            }
        });
    });

    document.getElementById('transaction-description').addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            handleDescriptionAutocomplete(e.target.value);
        }, 300);
    });

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

    document.getElementById('payment-method').addEventListener('change', (e) => {
        const creditCardWrapper = document.getElementById('credit-card-wrapper');
        const installmentOptionsWrapper = document.getElementById('installment-options-wrapper');
        const accountWrapper = document.getElementById('transaction-account-wrapper');

        if (e.target.value === 'credit_card') {
            creditCardWrapper.style.display = 'block';
            installmentOptionsWrapper.style.display = 'block';
            accountWrapper.style.display = 'none';
        } else {
            creditCardWrapper.style.display = 'none';
            installmentOptionsWrapper.style.display = 'none';
            accountWrapper.style.display = 'block';
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
    const filterMonth = document.getElementById('filter-month');
    const filterYear = document.getElementById('filter-year');
    const filterStartDate = document.getElementById('filter-start-date');
    const filterEndDate = document.getElementById('filter-end-date');

    filterMonth.addEventListener('change', () => {
        filterStartDate.value = '';
        filterEndDate.value = '';
        app.loadUserDashboard();
    });
    filterYear.addEventListener('change', () => {
        filterStartDate.value = '';
        filterEndDate.value = '';
        app.loadUserDashboard();
    });
    
    const dateFilterHandler = () => {
        if (filterStartDate.value && filterEndDate.value) {
            filterMonth.value = 'all';
            filterYear.disabled = true;
            filterMonth.disabled = true;
            app.loadUserDashboard();
        } else if (!filterStartDate.value && !filterEndDate.value) {
            filterYear.disabled = false;
            filterMonth.disabled = false;
        }
    };

    filterStartDate.addEventListener('change', dateFilterHandler);
    filterEndDate.addEventListener('change', dateFilterHandler);

    document.getElementById('filter-description').addEventListener('input', app.applyFiltersAndUpdateDashboard);
    document.getElementById('filter-category').addEventListener('change', app.applyFiltersAndUpdateDashboard);
    document.getElementById('filter-tag').addEventListener('input', app.applyFiltersAndUpdateDashboard);
    document.getElementById('filter-payment-method').addEventListener('change', app.applyFiltersAndUpdateDashboard);
    document.getElementById('filter-type').addEventListener('change', app.loadUserDashboard);
    document.getElementById('filter-sort').addEventListener('change', app.applyFiltersAndUpdateDashboard);

    document.getElementById('export-csv-button').addEventListener('click', handleExportCsv);
    document.getElementById('load-more-button').addEventListener('click', app.loadMoreTransactions);

    // --- Delegação de Eventos para a Lista de Transações ---
    document.getElementById('transactions-list').addEventListener('click', (e) => {
        const target = e.target;
        const transactionLi = target.closest('li');
        if (!transactionLi || !transactionLi.dataset.id) return;
        const transactionId = transactionLi.dataset.id;
        const transaction = state.allTransactions.find(t => t.id === transactionId);
        if (!transaction) return;

        if (transaction.type === 'transfer') {
            if (target.matches('.edit-btn')) {
                modals.openEditTransferModal(transaction);
            }
            if (target.matches('.delete-btn')) {
                handleDeleteTransfer(transaction);
            }
            return;
        }

        if (target.matches('.edit-btn')) {
            modals.openEditModal(transaction);
        }
        if (target.matches('.delete-btn')) {
            handleDeleteTransaction(transaction);
        }
    });

    // --- Delegação de Eventos para a Lista de Transações de Investimento ---
    transactionsInvestmentList.addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.delete-btn[data-movement-id]');
        const editButton = e.target.closest('.edit-btn[data-movement-id]');
        
        if (editButton && !editButton.disabled) {
            showNotification("Funcionalidade de edição de transação de investimento pendente.", "info");
        }

        if (deleteButton && !deleteButton.disabled) {
            const movementId = deleteButton.dataset.movementId;
            const txContainer = deleteButton.closest('.movement-item');
            
            const movementData = {
                id: movementId,
                portfolioId: txContainer.dataset.portfolioId,
                assetId: txContainer.dataset.assetId
            };
            
            handleDeleteInvestmentTransaction(movementData);
        }
    });

    // --- Listeners de Modais ---
    editTransactionForm.addEventListener('submit', handleUpdateTransaction);
    document.querySelector('.close-button').addEventListener('click', modals.closeEditModal);

    editTransferForm.addEventListener('submit', handleUpdateTransfer);
    document.querySelector('.close-edit-transfer-modal-button').addEventListener('click', modals.closeEditTransferModal);

    document.querySelector('.close-card-modal-button').addEventListener('click', modals.closeCardModal);
    document.getElementById('back-to-cards-button').addEventListener('click', modals.showCardManagementView);
    addCreditCardForm.addEventListener('submit', handleAddCreditCard);
    
    editCreditCardForm.addEventListener('submit', handleUpdateCreditCard);
    document.querySelector('.close-edit-card-modal-button').addEventListener('click', modals.closeEditCardModal);

    document.getElementById('credit-card-list').addEventListener('click', (e) => {
        const eventTarget = e.target.closest('[data-card-id]');
        if (!eventTarget) return;
        
        const cardId = eventTarget.dataset.cardId;
        const card = state.userCreditCards.find(c => c.id === cardId);
        if (!card) return;

        if (eventTarget.matches('.card-info')) {
            modals.showInvoiceDetailsView(card);
        } else if (eventTarget.matches('.delete-btn')) {
            handleDeleteCreditCard(cardId);
        } else if (eventTarget.matches('.edit-btn')) {
            modals.openEditCardModal(card);
        }
    });

    document.getElementById('invoice-period-select').addEventListener('change', async (e) => {
        const selectedInvoice = state.currentCardInvoices.find(inv => inv.id === e.target.value);
        if (selectedInvoice) await modals.displayInvoiceDetails(selectedInvoice);
    });

    document.getElementById('prev-invoice-button').addEventListener('click', () => handleNavigateInvoice('prev'));
    document.getElementById('next-invoice-button').addEventListener('click', () => handleNavigateInvoice('next'));

    document.getElementById('pay-invoice-button').addEventListener('click', modals.openPayInvoiceModal);
    payInvoiceForm.addEventListener('submit', handleConfirmInvoicePayment);
    document.querySelector('.close-pay-invoice-modal-button').addEventListener('click', modals.closePayInvoiceModal);

    document.getElementById('advance-payment-button').addEventListener('click', modals.openAdvancePaymentModal);
    advancePaymentForm.addEventListener('submit', handleConfirmAdvancePayment);
    document.querySelector('.close-advance-payment-modal-button').addEventListener('click', modals.closeAdvancePaymentModal);

    document.getElementById('invoice-transactions-list').addEventListener('click', (e) => {
        const eventTarget = e.target.closest('.action-btn[data-invoice-tx-id]');
        if (!eventTarget) return;

        const transactionId = eventTarget.dataset.invoiceTxId;
        const invoiceId = document.getElementById('invoice-period-select').value;

        if (eventTarget.matches('.edit-btn')) {
            modals.openEditInvoiceTransactionModal(transactionId);
        }
        if (eventTarget.matches('.delete-btn')) {
            if (invoiceId && transactionId) {
                handleDeleteInvoiceTransaction(invoiceId, transactionId);
            }
        }
    });

    document.querySelector('.close-edit-invoice-tx-modal-button').addEventListener('click', modals.closeEditInvoiceTransactionModal);
    editInvoiceTransactionForm.addEventListener('submit', handleUpdateInvoiceTransaction);
    
    // Listeners do Modal de Divisão
    splitTransactionButton.addEventListener('click', () => {
        const totalAmount = parseFloat(document.getElementById('transaction-amount').value);
        const type = document.querySelector('input[name="transaction-type"]:checked').value;
        modals.openSplitModal(totalAmount, type);
    });
    document.querySelector('.close-split-modal-button').addEventListener('click', modals.closeSplitModal);
    document.getElementById('cancel-split-button').addEventListener('click', modals.closeSplitModal);
    addSplitForm.addEventListener('submit', handleAddSplitItem);
    splitList.addEventListener('click', (e) => {
        if (e.target.matches('.delete-btn')) {
            const index = e.target.dataset.index;
            modals.removeSplitItem(parseInt(index));
        }
    });
    confirmSplitButton.addEventListener('click', handleConfirmSplit);

    document.querySelector('.close-settings-modal-button').addEventListener('click', modals.closeSettingsModal);
    document.querySelector('.close-management-modal-button').addEventListener('click', modals.closeManagementModal);
    
    themeToggle.addEventListener('change', () => app.toggleTheme(themeToggle.checked));
    
    document.querySelector('#settings-modal .modal-tabs').addEventListener('click', (e) => {
        if (e.target.matches('.tab-link')) {
            const tabId = e.target.dataset.tab;
            modals.switchSettingsTab(tabId);
        }
    });

    document.querySelector('#management-modal .modal-tabs').addEventListener('click', (e) => {
        if (e.target.matches('.tab-link')) {
            const tabId = e.target.dataset.tab;
            modals.switchManagementTab(tabId);
        }
    });

    document.getElementById('save-dashboard-customization-button').addEventListener('click', () => {
        app.saveDashboardVisibility();
        showNotification("Preferências do dashboard salvas!", "success");
        modals.closeSettingsModal();
    });

    addAccountForm.addEventListener('submit', handleAddAccount);
    addCategoryForm.addEventListener('submit', handleAddCategory);
    setBudgetForm.addEventListener('submit', handleSetBudget);
    addRecurringForm.addEventListener('submit', handleAddRecurring);

    const categoryContainer = document.getElementById('category-lists-container');
    categoryContainer.addEventListener('click', (e) => {
        const target = e.target;
        const categoryItem = target.closest('.category-item');
        if (!categoryItem) return;
        const categoryId = categoryItem.dataset.categoryId;
        if (target.matches('.toggle-subcategories-btn')) {
            const subcontainer = categoryItem.querySelector('.subcategory-container');
            const isHidden = subcontainer.style.display === 'none';
            subcontainer.style.display = isHidden ? 'block' : 'none';
            target.innerHTML = isHidden ? '&#9652;' : '&#9662;';
        }
        if (target.matches('.delete-category-btn')) {
            handleDeleteCategory(categoryId);
        }
        if (target.matches('.delete-subcategory-btn')) {
            const subcategoryName = target.dataset.subcategoryName;
            handleDeleteSubcategory(categoryId, subcategoryName);
        }
    });

    categoryContainer.addEventListener('submit', (e) => {
        if (e.target.matches('.add-subcategory-form')) {
            e.preventDefault();
            const form = e.target;
            const categoryItem = form.closest('.category-item');
            const categoryId = categoryItem.dataset.categoryId;
            const subcategoryName = form.querySelector('.new-subcategory-name').value;
            handleAddSubcategory(categoryId, subcategoryName, form);
        }
    });
    
    document.getElementById('budget-list').addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.delete-btn[data-budget-id]');
        if (deleteButton) {
            const budgetId = deleteButton.dataset.budgetId;
            handleDeleteBudget(budgetId);
        }
    });

    // --- INÍCIO DA ALTERAÇÃO ---
    document.getElementById('account-list').addEventListener('click', (e) => {
        const archiveButton = e.target.closest('.archive-btn[data-account-id]');
        if (archiveButton) {
            const accountId = archiveButton.dataset.accountId;
            handleArchiveAccount(accountId);
        }
    });
    
    document.getElementById('archived-account-list').addEventListener('click', (e) => {
        const unarchiveButton = e.target.closest('.unarchive-btn[data-account-id]');
        if (unarchiveButton) {
            const accountId = unarchiveButton.dataset.accountId;
            handleUnarchiveAccount(accountId);
        }
    });
    // --- FIM DA ALTERAÇÃO ---
    
    document.getElementById('recurring-list').addEventListener('click', (e) => {
        const eventTarget = e.target.closest('.action-btn[data-recurring-id]');
        if (!eventTarget) return;
        const recurringId = eventTarget.dataset.recurringId;
        const recurringTx = state.userRecurringTransactions.find(tx => tx.id === recurringId);
        if (eventTarget.matches('.edit-btn') && recurringTx) modals.openEditRecurringModal(recurringTx);
        if (eventTarget.matches('.delete-btn') && recurringTx) handleDeleteRecurring(recurringTx);
    });

    document.getElementById('recurring-payment-method').addEventListener('change', (e) => {
        const accountWrapper = document.getElementById('recurring-account-wrapper');
        const cardWrapper = document.getElementById('recurring-card-wrapper');
        if (e.target.value === 'credit_card') {
            accountWrapper.style.display = 'none';
            cardWrapper.style.display = 'block';
        } else { // account_debit
            accountWrapper.style.display = 'block';
            cardWrapper.style.display = 'none';
        }
    });

    document.getElementById('edit-recurring-payment-method').addEventListener('change', (e) => {
        const accountWrapper = document.getElementById('edit-recurring-account-wrapper');
        const cardWrapper = document.getElementById('edit-recurring-card-wrapper');
        if (e.target.value === 'credit_card') {
            accountWrapper.style.display = 'none';
            cardWrapper.style.display = 'block';
        } else { // account_debit
            accountWrapper.style.display = 'block';
            cardWrapper.style.display = 'none';
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

    document.body.addEventListener('click', (e) => {
        if (e.target.id === 'go-to-accounts') {
            e.preventDefault();
            modals.openManagementModal();
            modals.switchManagementTab('account-management-tab');
        }
        if (e.target.id === 'go-to-budgets') {
            e.preventDefault();
            modals.openManagementModal();
            modals.switchManagementTab('budget-management-tab');
        }
    });
    
    document.querySelector('.close-edit-recurring-modal-button').addEventListener('click', modals.closeEditRecurringModal);
    editRecurringForm.addEventListener('submit', handleUpdateRecurring);
    
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) event.target.style.display = 'none';
    });

    // Listeners do Novo Dashboard de Investimentos
    portfolioFilterSelect.addEventListener('change', handlePortfolioFilterChange);
    backToInvestmentDashboardBtn.addEventListener('click', (e) => {
        e.preventDefault();
        investmentsUI.showInvestmentDashboardView();
    });

    // Listeners para o CRUD de Investimentos
    goToPortfoliosManagementBtn.addEventListener('click', (e) => {
        e.preventDefault();
        investmentsUI.showPortfoliosManagementView();
    });
    
    document.getElementById('back-to-portfolios-button').addEventListener('click', (e) => {
        e.preventDefault();
        investmentsUI.showPortfoliosView();
    });
    
    const backToAssetsFromDetailBtn = document.getElementById('back-to-assets-from-detail-button');
    if (backToAssetsFromDetailBtn) {
        backToAssetsFromDetailBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (state.selectedPortfolioForAssetsView) {
                investmentsUI.showAssetsView(state.selectedPortfolioForAssetsView);
            }
        });
    }

    // Listeners para a nova página de detalhes do ativo
    const assetDetailView = document.getElementById('asset-detail-view');
    if (assetDetailView) {
        // Listener para as abas
        assetDetailView.querySelector('.modal-tabs').addEventListener('click', (e) => {
            if (e.target.matches('.tab-link')) {
                const tabId = e.target.dataset.assetTab;
                assetDetailView.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                assetDetailView.querySelectorAll('.tab-link').forEach(b => b.classList.remove('active'));
                assetDetailView.querySelector(`#${tabId}`).classList.add('active');
                e.target.classList.add('active');
            }
        });

        // Listener para o formulário de adicionar provento
        const addDetailProventoForm = document.getElementById('add-asset-detail-provento-form');
        addDetailProventoForm.addEventListener('submit', handleAddProventoFromDetail);

        // Listener para a lista de operações (para exclusão)
        const detailMovementsList = document.getElementById('asset-detail-movements-list');
        detailMovementsList.addEventListener('click', handleMovementsListActions);
    }

    document.querySelector('.close-edit-portfolio-modal-button').addEventListener('click', investmentsUI.closeEditPortfolioModal);
    document.querySelector('.close-edit-asset-modal-button').addEventListener('click', investmentsUI.closeEditAssetModal);
    document.querySelector('.close-edit-movement-modal-button').addEventListener('click', investmentsUI.closeEditMovementModal);

    editPortfolioForm.addEventListener('submit', handleUpdatePortfolio);
    editAssetForm.addEventListener('submit', handleUpdateAsset);
    editMovementForm.addEventListener('submit', handleUpdateMovement);
}


// --- Funções "Handler" para Lógica de Eventos ---

async function handlePortfolioFilterChange(e) {
    const portfolioId = e.target.value;
    try {
        await investmentsUI.updateInvestmentDashboard(portfolioId); 
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// --- Handlers do CRUD de Investimentos ---

async function handleUpdatePortfolio(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const portfolioId = form['edit-portfolio-id'].value;
    const updatedData = {
        name: form['edit-portfolio-name'].value,
        description: form['edit-portfolio-description'].value,
    };

    try {
        await portfolios.updatePortfolio(portfolioId, updatedData);
        showNotification("Carteira atualizada com sucesso!");
        investmentsUI.closeEditPortfolioModal();
        await investmentsUI.loadAndRenderPortfolios();
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function handleUpdateAsset(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const portfolioId = state.selectedPortfolioForAssetsView.id;
    const assetId = form['edit-asset-id'].value;
    
    const updatedData = {
        name: form['edit-asset-name'].value,
        ticker: form['edit-asset-ticker'].value.toUpperCase(),
        type: form['edit-asset-type'].value,
        assetClass: form['edit-asset-class'].value,
        broker: form['edit-asset-broker'].value,
    };

    try {
        await assets.updateAsset(portfolioId, assetId, updatedData);
        showNotification("Ativo atualizado com sucesso!");
        investmentsUI.closeEditAssetModal();
        await investmentsUI.loadAndRenderAssets(portfolioId);
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

function handleUpdateMovement(e) {
    e.preventDefault();
    showNotification("Lógica de salvar edição de movimento pendente.", "info");
}

async function handleMovementsListActions(e) {
    const editButton = e.target.closest('.edit-btn[data-movement-id]');
    const deleteButton = e.target.closest('.delete-btn[data-movement-id]');

    if (editButton) {
        const movementId = editButton.dataset.movementId;
        investmentsUI.openEditMovementModal(movementId);
    }

    if (deleteButton) {
        const movementId = deleteButton.dataset.movementId;
        const currentAsset = state.selectedAssetForMovementsView;

        if (!currentAsset || !currentAsset.portfolioId) {
            showNotification("Erro: Não foi possível identificar o ativo ou carteira.", "error");
            return;
        }

        if (confirm("Tem certeza que deseja excluir esta operação? O saldo da sua conta e a posição do ativo serão recalculados. Esta ação é irreversível.")) {
            try {
                await movements.deleteMovementAndRecalculate(currentAsset.portfolioId, currentAsset.id, movementId);
                showNotification("Operação excluída e posição do ativo recalculada com sucesso!");
                await investmentsUI.refreshMovementsView();
            } catch (error) {
                showNotification(error.message, "error");
            }
        }
    }
}

async function handleDeleteInvestmentTransaction(movementData) {
    if (confirm("Tem certeza que deseja excluir esta transação de investimento? O movimento será removido, o saldo da sua conta será estornado e o preço médio do ativo será recalculado. Esta ação é irreversível.")) {
        try {
            await movements.deleteMovementAndRecalculate(
                movementData.portfolioId, 
                movementData.assetId, 
                movementData.id
            );
            showNotification("Transação de investimento excluída e dados financeiros estornados com sucesso!");
            
            await transactionsInvestmentUI.loadTransactionsPage();
            await app.loadUserDashboard();
            await app.loadUserAccounts();

        } catch (error) {
            showNotification(error.message, "error");
        }
    }
}

async function handleAddProventoFromDetail(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const currentAsset = state.selectedAssetForMovementsView;
    if (!currentAsset) {
        showNotification("Erro: Ativo não selecionado.", "error");
        submitButton.disabled = false;
        return;
    }

    const proventoData = {
        proventoType: form['detail-provento-type'].value,
        paymentDate: form['detail-provento-date'].value,
        valuePerShare: parseFloat(form['detail-provento-value-per-share'].value),
        accountId: form['detail-provento-account'].value,
        userId: state.currentUser.uid,
    };

    try {
        await movements.addProvento(currentAsset.portfolioId, currentAsset.id, proventoData);
        showNotification("Provento registrado com sucesso!");
        form.reset();
        
        await investmentsUI.refreshMovementsView();
        await app.loadUserAccounts();

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

function handleNavigateInvoice(direction) {
    const select = document.getElementById('invoice-period-select');
    if (!select || select.options.length <= 1) return;

    let currentIndex = select.selectedIndex;
    let newIndex;

    if (direction === 'next') {
        newIndex = Math.max(0, currentIndex - 1);
    } else {
        newIndex = Math.min(select.options.length - 1, currentIndex + 1);
    }

    if (newIndex !== currentIndex) {
        select.selectedIndex = newIndex;
        select.dispatchEvent(new Event('change'));
    }
}

function handleAddSplitItem(e) {
    e.preventDefault();
    const form = e.target;
    const category = form['split-category'].value;
    const amount = parseFloat(form['split-amount'].value);

    if (!category || isNaN(amount) || amount <= 0) {
        showNotification('Por favor, selecione uma categoria e insira um valor válido.', 'error');
        return;
    }
    
    modals.addSplitItem({ category, amount });
    form.reset();
}

function handleConfirmSplit() {
    isTransactionSplit = true;
    const categorySelect = document.getElementById('transaction-category');
    const subcategoryWrapper = document.getElementById('transaction-subcategory-wrapper');
    const categoryWrapper = document.getElementById('category-control-wrapper');
    
    categorySelect.disabled = true;
    subcategoryWrapper.style.display = 'none';
    categoryWrapper.querySelector('label').textContent = `Dividido em ${modals._currentSplits.length} categorias`;

    modals.closeSplitModal();
}

function resetSplitState() {
    isTransactionSplit = false;
    modals.clearSplits(); 
    const categorySelect = document.getElementById('transaction-category');
    const categoryWrapper = document.getElementById('category-control-wrapper');
    categorySelect.disabled = false;
    categoryWrapper.querySelector('label').textContent = 'Categoria';
}

async function handleConfirmInvoicePayment(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const invoiceId = form['pay-invoice-id'].value;
        const accountId = form['pay-invoice-account-select'].value;
        const paymentDate = form['pay-invoice-date'].value;

        if (!accountId) {
            throw new Error("Por favor, selecione uma conta para o pagamento.");
        }

        const selectedInvoice = state.currentCardInvoices.find(inv => inv.id === invoiceId);
        if (!selectedInvoice || !state.selectedCardForInvoiceView) {
            throw new Error("Fatura ou cartão não encontrado. Tente novamente.");
        }

        const paymentDetails = { accountId, paymentDate };

        await invoices.payInvoice(selectedInvoice, state.selectedCardForInvoiceView, paymentDetails);
        showNotification("Fatura paga com sucesso!");
        
        modals.closePayInvoiceModal();
        await modals.loadAndDisplayInvoices(state.selectedCardForInvoiceView);
        await app.loadUserDashboard();
        await app.loadUserAccounts();

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function handleConfirmAdvancePayment(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const invoiceId = form['advance-payment-invoice-id'].value;
        const accountId = form['advance-payment-account-select'].value;
        const amount = parseFloat(form['advance-payment-amount'].value);
        const date = form['advance-payment-date'].value;

        if (!accountId || !amount || amount <= 0 || !date) {
            throw new Error("Todos os campos são obrigatórios.");
        }
        
        await invoices.makeAdvancePayment(invoiceId, amount, accountId, date);
        showNotification("Pagamento antecipado realizado com sucesso!");

        modals.closeAdvancePaymentModal();
        await modals.loadAndDisplayInvoices(state.selectedCardForInvoiceView);
        await app.loadUserDashboard();
        await app.loadUserAccounts();
        
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function handleAddTransfer(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const transferData = {
        description: form['transfer-description'].value,
        amount: parseFloat(form['transfer-amount'].value),
        date: form['transfer-date'].value,
        fromAccountId: form['transfer-from-account'].value,
        toAccountId: form['transfer-to-account'].value,
        userId: state.currentUser.uid,
    };
    
    try {
        await transfers.addTransfer(transferData);
        showNotification("Transferência realizada com sucesso!");
        form.reset();
        document.getElementById('transfer-date').value = new Date().toISOString().split('T')[0];

        await app.loadUserDashboard();
        await app.loadUserAccounts();

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function handleUpdateTransfer(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const transferId = form['edit-transfer-id'].value;
    const updatedData = {
        description: form['edit-transfer-description'].value,
        amount: parseFloat(form['edit-transfer-amount'].value),
        date: form['edit-transfer-date'].value,
        fromAccountId: form['edit-transfer-from-account'].value,
        toAccountId: form['edit-transfer-to-account'].value,
    };

    try {
        await transfers.updateTransfer(transferId, updatedData);
        showNotification('Transferência atualizada com sucesso!');
        modals.closeEditTransferModal();
        await app.loadUserDashboard();
        await app.loadUserAccounts();
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function handleDeleteTransfer(transfer) {
    if (confirm(`Tem certeza que deseja excluir esta transferência?`)) {
        try {
            await transfers.deleteTransfer(transfer);
            showNotification('Transferência excluída com sucesso!');
            await app.loadUserDashboard();
            await app.loadUserAccounts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

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

    const tagsString = form['transaction-tags'].value;
    const tags = tagsString.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag);

    const paymentMethod = form['payment-method'].value;

    const transactionData = {
        description: form['transaction-description'].value,
        amount: parseFloat(form['transaction-amount'].value),
        date: form['transaction-date'].value,
        type: form['transaction-type'].value,
        paymentMethod: paymentMethod,
        userId: state.currentUser.uid,
        isInstallment: false,
        isSplit: isTransactionSplit,
        splits: isTransactionSplit ? modals._currentSplits : null,
        tags: tags.length > 0 ? tags : []
    };

    if (!isTransactionSplit) {
        const categorySelect = form['transaction-category'];
        const selectedCategoryOption = categorySelect.options[categorySelect.selectedIndex];
        transactionData.category = selectedCategoryOption.value;
        transactionData.categoryId = selectedCategoryOption.dataset.categoryId;
        transactionData.subcategory = form['transaction-subcategory'].value.trim();
        if (!transactionData.category) {
            showNotification("Por favor, selecione uma categoria.", 'error');
            submitButton.disabled = false;
            return;
        }
    } else {
        transactionData.category = "Dividido";
    }

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
    } else {
        const accountId = form['transaction-account'].value;
        if (!accountId) {
            showNotification("Por favor, selecione uma conta.", 'error');
            submitButton.disabled = false;
            return;
        }
        transactionData.accountId = accountId;
    }
    
    try {
        await transactions.addTransaction(transactionData, cardData);
        showNotification("Transação adicionada com sucesso!");
        form.reset();
        resetSplitState();
        document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('credit-card-wrapper').style.display = 'none';
        document.getElementById('installment-options-wrapper').style.display = 'none';
        document.getElementById('installments-count-wrapper').style.display = 'none';
        document.getElementById('transaction-amount-label').textContent = 'Valor (R$)';
        document.getElementById('transaction-subcategory-wrapper').style.display = 'none';
        
        await app.loadUserDashboard();
        await app.loadUserAccounts();
        
        if (!isTransactionSplit && transactionData.subcategory) {
            app.loadUserCategories();
        }
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function handleDeleteTransaction(transaction) {
    if (confirm(`Tem certeza que deseja excluir a transação "${transaction.description}"?`)) {
        try {
            await transactions.deleteTransaction(transaction);
            showNotification('Transação excluída com sucesso!');
            await app.loadUserDashboard();
            await app.loadUserAccounts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

async function handleUpdateTransaction(e) {
    e.preventDefault();
    const form = e.target;
    const transactionId = form['edit-transaction-id'].value;
    const paymentMethod = form['edit-payment-method'].value;
    
    const tagsString = form['edit-transaction-tags'].value;
    const tags = tagsString.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag);

    const updatedData = {
        description: form['edit-transaction-description'].value,
        amount: parseFloat(form['edit-transaction-amount'].value),
        date: form['edit-transaction-date'].value,
        type: form['edit-transaction-type'].value,
        category: form['edit-transaction-category'].value,
        paymentMethod: paymentMethod,
        tags: tags.length > 0 ? tags : []
    };
    
    if (paymentMethod === 'credit_card') {
        updatedData.cardId = form['edit-credit-card-select'].value;
    } else {
        updatedData.accountId = form['edit-transaction-account'].value;
        if (!updatedData.accountId) {
            showNotification("Por favor, selecione uma conta.", "error");
            return;
        }
    }

    try {
        await transactions.updateTransaction(transactionId, updatedData);
        showNotification('Transação atualizada com sucesso!');
        modals.closeEditModal();
        await app.loadUserDashboard();
        await app.loadUserAccounts();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleAddAccount(e) {
    e.preventDefault();
    const form = e.target;
    const accountData = {
        name: form['account-name'].value,
        initialBalance: parseFloat(form['account-initial-balance'].value),
        type: 'checking',
        userId: state.currentUser.uid
    };
    try {
        await accounts.addAccount(accountData);
        showNotification("Conta adicionada com sucesso!");
        form.reset();
        await app.loadUserAccounts();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleArchiveAccount(accountId) {
    const account = state.userAccounts.find(acc => acc.id === accountId);
    if (!account) return;

    if (confirm(`Tem certeza que deseja arquivar a conta "${account.name}"? Ela não aparecerá mais nas listas de transações.`)) {
        try {
            await accounts.archiveAccount(accountId);
            showNotification('Conta arquivada com sucesso!');
            await app.loadUserAccounts(); // Recarrega contas ativas
            await modals.loadAndRenderArchivedAccounts(); // Recarrega a lista de arquivadas no modal
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

async function handleUnarchiveAccount(accountId) {
    const account = state.archivedAccounts.find(acc => acc.id === accountId);
    if (!account) return;
    
    if (confirm(`Deseja reativar a conta "${account.name}"?`)) {
        try {
            await accounts.unarchiveAccount(accountId);
            showNotification('Conta reativada com sucesso!');
            await app.loadUserAccounts();
            await modals.loadAndRenderArchivedAccounts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
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

async function handleDeleteInvoiceTransaction(invoiceId, transactionId) {
    if (confirm('Tem certeza que deseja excluir este lançamento?')) {
        try {
            await invoices.deleteInvoiceTransaction(invoiceId, transactionId);
            showNotification('Lançamento excluído com sucesso!');
            if (state.selectedCardForInvoiceView) {
                await modals.loadAndDisplayInvoices(state.selectedCardForInvoiceView);
            }
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

async function handleAddCreditCard(e) {
    e.preventDefault();
    const form = e.target;
    const cardData = {
        name: form['card-name'].value,
        closingDay: parseInt(form['card-closing-day'].value),
        dueDay: parseInt(form['card-due-day'].value),
        limit: parseFloat(form['card-limit'].value),
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

async function handleUpdateCreditCard(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const cardId = form['edit-card-id'].value;
    const updatedData = {
        name: form['edit-card-name'].value,
        closingDay: parseInt(form['edit-card-closing-day'].value),
        dueDay: parseInt(form['edit-card-due-day'].value),
        limit: parseFloat(form['edit-card-limit'].value),
    };

    try {
        await creditCard.updateCreditCard(cardId, updatedData);
        showNotification('Cartão atualizado com sucesso!');
        modals.closeEditCardModal();
        await app.loadUserCreditCards();
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
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

async function handleAddSubcategory(categoryId, subcategoryName, form) {
    if (!subcategoryName.trim()) {
        showNotification("O nome da subcategoria não pode estar vazio.", "error");
        return;
    }
    try {
        await categories.addSubcategory(categoryId, subcategoryName);
        showNotification("Subcategoria adicionada com sucesso!");
        form.reset();
        await app.loadUserCategories();
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
        paymentMethod: form['recurring-payment-method'].value,
        userId: state.currentUser.uid
    };

    if (recurringData.paymentMethod === 'credit_card') {
        recurringData.cardId = form['recurring-card'].value;
        recurringData.accountId = null;
    } else { // account_debit
        recurringData.accountId = form['recurring-account'].value;
        recurringData.cardId = null;
    }

    try {
        await recurring.addRecurringTransaction(recurringData);
        showNotification("Recorrência adicionada com sucesso!");
        form.reset();
        document.getElementById('recurring-account-wrapper').style.display = 'block';
        document.getElementById('recurring-card-wrapper').style.display = 'none';

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
        paymentMethod: form['edit-recurring-payment-method'].value,
    };

    if (updatedData.paymentMethod === 'credit_card') {
        updatedData.cardId = form['edit-recurring-card'].value;
        updatedData.accountId = null;
    } else { // account_debit
        updatedData.accountId = form['edit-recurring-account'].value;
        updatedData.cardId = null;
    }

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

    const headers = ['Data', 'Descrição', 'Valor', 'Tipo', 'Categoria', 'Subcategoria', 'Método de Pagamento'];
    const csvRows = state.filteredTransactions.map(t => {
        const row = [
            t.date.toLocaleDateString('pt-BR'),
            `"${t.description.replace(/"/g, '""')}"`,
            t.amount.toFixed(2).replace('.', ','),
            t.type === 'revenue' ? 'Receita' : 'Despesa',
            t.category,
            t.subcategory || '',
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
