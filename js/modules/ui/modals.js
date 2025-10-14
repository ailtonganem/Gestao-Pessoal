// js/modules/ui/modals.js

/**
 * Módulo para gerenciar a lógica e o comportamento de todos os modais da aplicação.
 */

import * as state from '../state.js';
import * as render from './render.js';
import { formatDateToInput } from './utils.js';
import { showNotification } from './notifications.js';
import { getInvoices, getInvoiceTransactions } from '../invoices.js';

// --- Seleção de Elementos do DOM (Modais e seus conteúdos) ---
const editModal = document.getElementById('edit-modal');
const creditCardModal = document.getElementById('credit-card-modal');
const settingsModal = document.getElementById('settings-modal');

// Elementos do Modal de Edição
const editTransactionIdInput = document.getElementById('edit-transaction-id');
const editTransactionDescriptionInput = document.getElementById('edit-transaction-description');
const editTransactionAmountInput = document.getElementById('edit-transaction-amount');
const editTransactionDateInput = document.getElementById('edit-transaction-date');
const editTransactionCategorySelect = document.getElementById('edit-transaction-category');
const editPaymentMethodSelect = document.getElementById('edit-payment-method');
const editCreditCardWrapper = document.getElementById('edit-credit-card-wrapper');

// Elementos do Modal de Cartões
const cardManagementView = document.getElementById('card-management-view');
const invoiceDetailsView = document.getElementById('invoice-details-view');
const invoiceCardName = document.getElementById('invoice-card-name');
const invoicePeriodSelect = document.getElementById('invoice-period-select');
const payInvoiceButton = document.getElementById('pay-invoice-button');

// Elementos do Modal de Configurações
const adminTabButton = document.getElementById('admin-tab-button');


// --- Funções de Gerenciamento do Modal de Edição ---

/** Abre e preenche o modal de edição com os dados da transação. */
export function openEditModal(transaction) {
    editTransactionIdInput.value = transaction.id;
    editTransactionDescriptionInput.value = transaction.description;
    editTransactionAmountInput.value = transaction.amount;
    editTransactionDateInput.value = formatDateToInput(transaction.date);
    document.querySelector(`input[name="edit-transaction-type"][value="${transaction.type}"]`).checked = true;

    // Popula as categorias e define o valor correto
    render.populateCategorySelects(transaction.type, editTransactionCategorySelect);
    editTransactionCategorySelect.value = transaction.category;

    editPaymentMethodSelect.value = transaction.paymentMethod;
    editCreditCardWrapper.style.display = transaction.paymentMethod === 'credit_card' ? 'block' : 'none';

    editModal.style.display = 'flex';
}

/** Fecha o modal de edição. */
export function closeEditModal() {
    editModal.style.display = 'none';
}


// --- Funções de Gerenciamento do Modal de Cartões ---

/** Abre o modal de gerenciamento de cartões. */
export function openCardModal() {
    showCardManagementView(); // Garante que sempre abra na lista de cartões
    creditCardModal.style.display = 'flex';
}

/** Fecha o modal de gerenciamento de cartões. */
export function closeCardModal() {
    creditCardModal.style.display = 'none';
}

/** Troca a visão no modal para a de detalhes da fatura e inicia o carregamento. */
export function showInvoiceDetailsView(card) {
    state.setSelectedCardForInvoiceView(card);
    invoiceCardName.textContent = `Faturas - ${card.name}`;
    loadAndDisplayInvoices(card);
    cardManagementView.style.display = 'none';
    invoiceDetailsView.style.display = 'block';
}

/** Troca a visão no modal de volta para a lista de cartões. */
export function showCardManagementView() {
    state.setSelectedCardForInvoiceView(null);
    state.setCurrentCardInvoices([]);
    cardManagementView.style.display = 'block';
    invoiceDetailsView.style.display = 'none';
}

/** Carrega as faturas de um cartão e as exibe no modal. */
export async function loadAndDisplayInvoices(card) {
    invoicePeriodSelect.innerHTML = '<option>Carregando faturas...</option>';
    try {
        const invoices = await getInvoices(card.id);
        state.setCurrentCardInvoices(invoices);

        if (invoices.length === 0) {
            render.renderEmptyInvoiceDetails();
        } else {
            render.renderInvoicePeriodSelect(invoices);
            displayInvoiceDetails(invoices[0]); // Exibe a fatura mais recente por padrão
        }
    } catch (error) {
        showNotification(error.message, 'error');
        invoicePeriodSelect.innerHTML = '<option>Erro ao carregar faturas</option>';
    }
}

/** Exibe os detalhes de uma fatura selecionada. */
export async function displayInvoiceDetails(invoice) {
    render.renderInvoiceSummary(invoice);
    payInvoiceButton.disabled = invoice.status !== 'closed';

    render.renderInvoiceTransactionsList([{ description: 'Carregando...', amount: '' }]);
    try {
        const transactions = await getInvoiceTransactions(invoice.id);
        render.renderInvoiceTransactionsList(transactions);
    } catch (error) {
        showNotification(error.message, 'error');
        render.renderInvoiceTransactionsList([{ description: 'Erro ao carregar.', amount: '' }]);
    }
}


// --- Funções de Gerenciamento do Modal de Configurações ---

/** Abre o modal de configurações e renderiza o conteúdo inicial. */
export function openSettingsModal() {
    if (state.currentUserProfile) {
        if (state.currentUserProfile.role === 'admin') {
            adminTabButton.style.display = 'block';
            render.renderUserList(); // Renderiza a lista de usuários para o admin
        }
        // Renderiza as listas que são relevantes para todos os usuários
        render.renderRecurringList();
        render.renderBudgetList();
    }
    settingsModal.style.display = 'flex';
}

/** Fecha o modal de configurações. */
export function closeSettingsModal() {
    settingsModal.style.display = 'none';
}
