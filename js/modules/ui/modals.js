// js/modules/ui/modals.js

/**
 * Módulo para gerenciar a lógica e o comportamento de todos os modais da aplicação.
 */

import * as state from '../state.js';
import * as render from './render.js';
import { formatDateToInput, formatCurrency } from './utils.js';
import { showNotification } from './notifications.js';
import { getInvoices, getInvoiceTransactions } from '../invoices.js';
import { getRecurringTransactions } from '../recurring.js';
import { getAllUsers } from '../admin.js';

// --- Variáveis de Estado do Módulo ---
let _currentInvoiceTransactions = []; // Armazena os lançamentos da fatura em visualização
// INÍCIO DA ALTERAÇÃO
export let _currentSplits = []; // Armazena os itens da divisão da transação
// FIM DA ALTERAÇÃO

// --- Seleção de Elementos do DOM (Modais e seus conteúdos) ---
const editModal = document.getElementById('edit-modal');
const creditCardModal = document.getElementById('credit-card-modal');
const settingsModal = document.getElementById('settings-modal');
const editRecurringModal = document.getElementById('edit-recurring-modal');
const editInvoiceTxModal = document.getElementById('edit-invoice-transaction-modal');
const payInvoiceModal = document.getElementById('pay-invoice-modal');
const advancePaymentModal = document.getElementById('advance-payment-modal');
const editTransferModal = document.getElementById('edit-transfer-modal');
const editCardModal = document.getElementById('edit-card-modal');
// INÍCIO DA ALTERAÇÃO
const splitTransactionModal = document.getElementById('split-transaction-modal');
// FIM DA ALTERAÇÃO

// Elementos do Modal de Edição de Transação
const editTransactionIdInput = document.getElementById('edit-transaction-id');
const editTransactionDescriptionInput = document.getElementById('edit-transaction-description');
const editTransactionAmountInput = document.getElementById('edit-transaction-amount');
const editTransactionDateInput = document.getElementById('edit-transaction-date');
const editTransactionCategorySelect = document.getElementById('edit-transaction-category');
const editPaymentMethodSelect = document.getElementById('edit-payment-method');
const editCreditCardWrapper = document.getElementById('edit-credit-card-wrapper');
const editAccountWrapper = document.getElementById('edit-account-wrapper');
const editTransactionAccountSelect = document.getElementById('edit-transaction-account');

// Elementos do Modal de Edição de Recorrência
const editRecurringIdInput = document.getElementById('edit-recurring-id');
const editRecurringDescriptionInput = document.getElementById('edit-recurring-description');
const editRecurringAmountInput = document.getElementById('edit-recurring-amount');
const editRecurringDayInput = document.getElementById('edit-recurring-day');
const editRecurringCategorySelect = document.getElementById('edit-recurring-category');

// Elementos do Modal de Edição de Lançamento de Fatura
const editInvoiceTxIdInput = document.getElementById('edit-invoice-transaction-id');
const editInvoiceIdInput = document.getElementById('edit-invoice-id');
const editInvoiceCardIdInput = document.getElementById('edit-invoice-card-id');
const editInvoiceTxDescriptionInput = document.getElementById('edit-invoice-tx-description');
const editInvoiceTxAmountInput = document.getElementById('edit-invoice-tx-amount');
const editInvoiceTxDateInput = document.getElementById('edit-invoice-tx-date');
const editInvoiceTxCategorySelect = document.getElementById('edit-invoice-tx-category');

// Elementos do Modal de Cartões
const cardManagementView = document.getElementById('card-management-view');
const invoiceDetailsView = document.getElementById('invoice-details-view');
const invoiceCardName = document.getElementById('invoice-card-name');
const invoicePeriodSelect = document.getElementById('invoice-period-select');
const payInvoiceButton = document.getElementById('pay-invoice-button');

// Elementos do Modal de Edição de Cartão
const editCardIdInput = document.getElementById('edit-card-id');
const editCardNameInput = document.getElementById('edit-card-name');
const editCardClosingDayInput = document.getElementById('edit-card-closing-day');
const editCardDueDayInput = document.getElementById('edit-card-due-day');
const editCardLimitInput = document.getElementById('edit-card-limit');

// INÍCIO DA ALTERAÇÃO
// Elementos do Modal de Divisão
const splitTotalAmountEl = document.getElementById('split-total-amount');
const splitRemainingAmountEl = document.getElementById('split-remaining-amount');
const splitListEl = document.getElementById('split-list');
const splitCategorySelect = document.getElementById('split-category');
const confirmSplitButton = document.getElementById('confirm-split-button');
let totalSplitAmount = 0;
// FIM DA ALTERAÇÃO

// Elementos do Modal de Configurações
const adminTabButton = document.getElementById('admin-tab-button');

// Elementos do Modal de Pagamento de Fatura
const payInvoiceIdInput = document.getElementById('pay-invoice-id');
const payInvoiceDateInput = document.getElementById('pay-invoice-date');

// Elementos do Modal de Pagamento Antecipado
const advancePaymentInvoiceIdInput = document.getElementById('advance-payment-invoice-id');
const advancePaymentDateInput = document.getElementById('advance-payment-date');
const advancePaymentAmountInput = document.getElementById('advance-payment-amount');

// Elementos do Modal de Edição de Transferência
const editTransferIdInput = document.getElementById('edit-transfer-id');
const editTransferDescriptionInput = document.getElementById('edit-transfer-description');
const editTransferAmountInput = document.getElementById('edit-transfer-amount');
const editTransferDateInput = document.getElementById('edit-transfer-date');
const editTransferFromAccountSelect = document.getElementById('edit-transfer-from-account');
const editTransferToAccountSelect = document.getElementById('edit-transfer-to-account');


// --- Funções de Gerenciamento do Modal de Edição de Transação ---

export function openEditModal(transaction) {
    editTransactionIdInput.value = transaction.id;
    editTransactionDescriptionInput.value = transaction.description;
    editTransactionAmountInput.value = transaction.amount;
    editTransactionDateInput.value = formatDateToInput(transaction.date);
    document.querySelector(`input[name="edit-transaction-type"][value="${transaction.type}"]`).checked = true;

    render.populateCategorySelects(transaction.type, editTransactionCategorySelect);
    editTransactionCategorySelect.value = transaction.category;

    editPaymentMethodSelect.value = transaction.paymentMethod;

    if (transaction.paymentMethod === 'credit_card') {
        editCreditCardWrapper.style.display = 'block';
        editAccountWrapper.style.display = 'none';
        // Futuramente, popular e selecionar o cartão correto aqui, se necessário
    } else {
        editCreditCardWrapper.style.display = 'none';
        editAccountWrapper.style.display = 'block';
        editTransactionAccountSelect.value = transaction.accountId;
    }

    editModal.style.display = 'flex';
}

export function closeEditModal() {
    editModal.style.display = 'none';
}


// --- Funções de Gerenciamento do Modal de Edição de Recorrência ---

export function openEditRecurringModal(recurringTx) {
    editRecurringIdInput.value = recurringTx.id;
    editRecurringDescriptionInput.value = recurringTx.description;
    editRecurringAmountInput.value = recurringTx.amount;
    editRecurringDayInput.value = recurringTx.dayOfMonth;
    document.querySelector(`input[name="edit-recurring-type"][value="${recurringTx.type}"]`).checked = true;

    render.populateCategorySelects(recurringTx.type, editRecurringCategorySelect);
    editRecurringCategorySelect.value = recurringTx.category;

    editRecurringModal.style.display = 'flex';
}

export function closeEditRecurringModal() {
    editRecurringModal.style.display = 'none';
}


// --- Funções para o modal de edição de lançamento de fatura ---

export function openEditInvoiceTransactionModal(transactionId) {
    const tx = _currentInvoiceTransactions.find(t => t.id === transactionId);
    if (!tx) {
        showNotification('Lançamento não encontrado.', 'error');
        return;
    }

    editInvoiceTxIdInput.value = tx.id;
    editInvoiceIdInput.value = document.getElementById('invoice-period-select').value;
    editInvoiceCardIdInput.value = state.selectedCardForInvoiceView.id;

    editInvoiceTxDescriptionInput.value = tx.description;
    editInvoiceTxAmountInput.value = tx.amount;
    editInvoiceTxDateInput.value = formatDateToInput(tx.purchaseDate);
    
    render.populateCategorySelects('expense', editInvoiceTxCategorySelect);
    editInvoiceTxCategorySelect.value = tx.category;

    editInvoiceTxModal.style.display = 'flex';
}

export function closeEditInvoiceTransactionModal() {
    editInvoiceTxModal.style.display = 'none';
}


// --- Funções de Gerenciamento do Modal de Cartões ---

export function openCardModal() {
    showCardManagementView();
    creditCardModal.style.display = 'flex';
}

export function closeCardModal() {
    creditCardModal.style.display = 'none';
}
export function openEditCardModal(card) {
    editCardIdInput.value = card.id;
    editCardNameInput.value = card.name;
    editCardClosingDayInput.value = card.closingDay;
    editCardDueDayInput.value = card.dueDay;
    editCardLimitInput.value = card.limit;
    
    editCardModal.style.display = 'flex';
}

export function closeEditCardModal() {
    const form = document.getElementById('edit-credit-card-form');
    if(form) form.reset();
    editCardModal.style.display = 'none';
}

// --- INÍCIO DA ALTERAÇÃO: Funções de Gerenciamento do Modal de Divisão ---

export function openSplitModal(totalAmount, type) {
    if (isNaN(totalAmount) || totalAmount <= 0) {
        showNotification('Por favor, insira um valor de transação válido antes de dividir.', 'error');
        return;
    }
    totalSplitAmount = totalAmount;
    _currentSplits = []; // Limpa divisões anteriores
    
    render.populateCategorySelects(type, splitCategorySelect);
    updateSplitSummary();
    renderSplits();

    splitTransactionModal.style.display = 'flex';
}

export function closeSplitModal() {
    splitTransactionModal.style.display = 'none';
    _currentSplits = [];
    totalSplitAmount = 0;
}

export function addSplitItem(split) {
    _currentSplits.push(split);
    updateSplitSummary();
    renderSplits();
}

export function removeSplitItem(index) {
    _currentSplits.splice(index, 1);
    updateSplitSummary();
    renderSplits();
}

function updateSplitSummary() {
    const spentAmount = _currentSplits.reduce((sum, split) => sum + split.amount, 0);
    const remainingAmount = totalSplitAmount - spentAmount;

    splitTotalAmountEl.textContent = formatCurrency(totalSplitAmount);
    splitRemainingAmountEl.textContent = formatCurrency(remainingAmount);
    splitRemainingAmountEl.style.color = remainingAmount < 0 ? 'var(--error-color)' : 'var(--text-color)';

    // Habilita o botão de confirmar apenas se a divisão estiver correta
    confirmSplitButton.disabled = remainingAmount !== 0;
}

function renderSplits() {
    splitListEl.innerHTML = '';
    if (_currentSplits.length === 0) {
        splitListEl.innerHTML = '<li style="text-align: center; color: #7f8c8d;">Nenhuma divisão adicionada.</li>';
        return;
    }

    _currentSplits.forEach((split, index) => {
        const li = document.createElement('li');
        li.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid var(--background-color);';
        li.innerHTML = `
            <span>${split.category}: ${formatCurrency(split.amount)}</span>
            <button class="action-btn delete-btn" data-index="${index}" title="Excluir Divisão">&times;</button>
        `;
        splitListEl.appendChild(li);
    });
}
// --- FIM DA ALTERAÇÃO ---

export function showInvoiceDetailsView(card) {
    state.setSelectedCardForInvoiceView(card);
    invoiceCardName.textContent = `Faturas - ${card.name}`;
    loadAndDisplayInvoices(card);
    cardManagementView.style.display = 'none';
    invoiceDetailsView.style.display = 'block';
}

export function showCardManagementView() {
    state.setSelectedCardForInvoiceView(null);
    state.setCurrentCardInvoices([]);
    _currentInvoiceTransactions = [];
    cardManagementView.style.display = 'block';
    invoiceDetailsView.style.display = 'none';
}

export async function loadAndDisplayInvoices(card) {
    invoicePeriodSelect.innerHTML = '<option>Carregando faturas...</option>';
    try {
        const invoices = await getInvoices(card.id, state.currentUser.uid);
        state.setCurrentCardInvoices(invoices);

        if (invoices.length === 0) {
            render.renderEmptyInvoiceDetails();
        } else {
            render.renderInvoicePeriodSelect(invoices);
            await displayInvoiceDetails(invoices[0]);
        }
    } catch (error) {
        showNotification(error.message, 'error');
        invoicePeriodSelect.innerHTML = '<option>Erro ao carregar faturas</option>';
    }
}

export async function displayInvoiceDetails(invoice) {
    render.renderInvoiceSummary(invoice);
    payInvoiceButton.disabled = invoice.status !== 'closed';

    render.renderInvoiceTransactionsList([{ description: 'Carregando...', amount: '' }]);
    try {
        const transactions = await getInvoiceTransactions(invoice.id);
        _currentInvoiceTransactions = transactions;
        render.renderInvoiceTransactionsList(transactions);
    } catch (error) {
        showNotification(error.message, 'error');
        _currentInvoiceTransactions = [];
        render.renderInvoiceTransactionsList([{ description: 'Erro ao carregar.', amount: '' }]);
    }
}


// --- Funções de Gerenciamento do Modal de Configurações ---

export async function openSettingsModal() {
    if (!state.currentUser) return;

    document.getElementById('recurring-list').innerHTML = '<li>Carregando...</li>';
    if (state.currentUserProfile.role === 'admin') {
        document.getElementById('user-list').innerHTML = '<li>Carregando...</li>';
    }

    settingsModal.style.display = 'flex';
    
    try {
        const recurringTxs = await getRecurringTransactions(state.currentUser.uid);
        state.setUserRecurringTransactions(recurringTxs);
        render.renderRecurringList();

        if (state.currentUserProfile.role === 'admin') {
            adminTabButton.style.display = 'block';
            const users = await getAllUsers();
            render.renderUserList(users);
        }

        render.renderBudgetList();
        render.renderAccountList();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

export function closeSettingsModal() {
    settingsModal.style.display = 'none';
}

/**
 * Alterna a visibilidade das abas no modal de configurações.
 * @param {string} tabId - O ID do conteúdo da aba a ser exibida.
 */
export function switchSettingsTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelectorAll('.tab-link').forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.tab-link[data-tab="${tabId}"]`).classList.add('active');
}

// --- Funções para o modal de pagamento de fatura ---

/**
 * Abre o modal para pagamento de fatura, preenchendo os dados necessários.
 */
export function openPayInvoiceModal() {
    const selectedInvoiceId = invoicePeriodSelect.value;
    const selectedInvoice = state.currentCardInvoices.find(inv => inv.id === selectedInvoiceId);

    if (!selectedInvoice) {
        showNotification("Nenhuma fatura selecionada para pagamento.", "error");
        return;
    }

    payInvoiceIdInput.value = selectedInvoice.id;
    payInvoiceDateInput.value = formatDateToInput(new Date());

    // As contas já devem estar populadas nos selects pela função render.populateAccountSelects
    // que é chamada quando os dados do usuário são carregados.
    
    payInvoiceModal.style.display = 'flex';
}

/**
 * Fecha o modal de pagamento de fatura e reseta o formulário.
 */
export function closePayInvoiceModal() {
    const form = document.getElementById('pay-invoice-form');
    if (form) {
        form.reset();
    }
    payInvoiceModal.style.display = 'none';
}

// --- Funções para o modal de pagamento antecipado ---

/**
 * Abre o modal para pagamento antecipado de fatura.
 */
export function openAdvancePaymentModal() {
    const selectedInvoiceId = invoicePeriodSelect.value;
    const selectedInvoice = state.currentCardInvoices.find(inv => inv.id === selectedInvoiceId);

    if (!selectedInvoice) {
        showNotification("Nenhuma fatura selecionada.", "error");
        return;
    }
    
    // Não permitir antecipação se a fatura não estiver aberta ou fechada
    if (selectedInvoice.status === 'paid') {
        showNotification("Não é possível antecipar pagamento de uma fatura já paga.", "error");
        return;
    }

    advancePaymentInvoiceIdInput.value = selectedInvoice.id;
    advancePaymentDateInput.value = formatDateToInput(new Date());
    advancePaymentAmountInput.max = selectedInvoice.totalAmount; // Impede o usuário de pagar mais do que o devido
    advancePaymentAmountInput.placeholder = `Valor máximo: ${selectedInvoice.totalAmount.toFixed(2)}`;

    advancePaymentModal.style.display = 'flex';
}

/**
 * Fecha o modal de pagamento antecipado e reseta o formulário.
 */
export function closeAdvancePaymentModal() {
    const form = document.getElementById('advance-payment-form');
    if (form) {
        form.reset();
    }
    advancePaymentModal.style.display = 'none';
}

/**
 * Abre o modal para editar uma transferência, preenchendo os dados existentes.
 * @param {object} transfer - O objeto da transferência a ser editada.
 */
export function openEditTransferModal(transfer) {
    editTransferIdInput.value = transfer.id;
    editTransferDescriptionInput.value = transfer.description;
    editTransferAmountInput.value = transfer.amount;
    editTransferDateInput.value = formatDateToInput(transfer.date);

    // Garante que os selects de conta estejam atualizados antes de selecionar os valores
    render.populateAccountSelects(); 

    editTransferFromAccountSelect.value = transfer.fromAccountId;
    editTransferToAccountSelect.value = transfer.toAccountId;
    
    editTransferModal.style.display = 'flex';
}

/**
 * Fecha o modal de edição de transferência.
 */
export function closeEditTransferModal() {
    const form = document.getElementById('edit-transfer-form');
    if (form) {
        form.reset();
    }
    editTransferModal.style.display = 'none';
}
