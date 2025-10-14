// js/modules/ui/modals.js

/**
 * Módulo para gerenciar a lógica e o comportamento de todos os modais da aplicação.
 */

import * as state from '../state.js';
import * as render from './render.js';
import { formatDateToInput } from './utils.js';
import { showNotification } from './notifications.js';
import { getInvoices, getInvoiceTransactions } from '../invoices.js';
// INÍCIO DA ALTERAÇÃO - Importa as funções de busca de dados
import { getRecurringTransactions } from '../recurring.js';
import { getAllUsers } from '../admin.js';
// FIM DA ALTERAÇÃO

// --- Seleção de Elementos do DOM (Modais e seus conteúdos) ---
const editModal = document.getElementById('edit-modal');
const creditCardModal = document.getElementById('credit-card-modal');
const settingsModal = document.getElementById('settings-modal');
const editRecurringModal = document.getElementById('edit-recurring-modal'); // Novo modal

// Elementos do Modal de Edição de Transação
const editTransactionIdInput = document.getElementById('edit-transaction-id');
const editTransactionDescriptionInput = document.getElementById('edit-transaction-description');
const editTransactionAmountInput = document.getElementById('edit-transaction-amount');
const editTransactionDateInput = document.getElementById('edit-transaction-date');
const editTransactionCategorySelect = document.getElementById('edit-transaction-category');
const editPaymentMethodSelect = document.getElementById('edit-payment-method');
const editCreditCardWrapper = document.getElementById('edit-credit-card-wrapper');

// Elementos do Modal de Edição de Recorrência (Novos)
const editRecurringIdInput = document.getElementById('edit-recurring-id');
const editRecurringDescriptionInput = document.getElementById('edit-recurring-description');
const editRecurringAmountInput = document.getElementById('edit-recurring-amount');
const editRecurringDayInput = document.getElementById('edit-recurring-day');
const editRecurringCategorySelect = document.getElementById('edit-recurring-category');

// Elementos do Modal de Cartões
const cardManagementView = document.getElementById('card-management-view');
const invoiceDetailsView = document.getElementById('invoice-details-view');
const invoiceCardName = document.getElementById('invoice-card-name');
const invoicePeriodSelect = document.getElementById('invoice-period-select');
const payInvoiceButton = document.getElementById('pay-invoice-button');

// Elementos do Modal de Configurações
const adminTabButton = document.getElementById('admin-tab-button');


// --- Funções de Gerenciamento do Modal de Edição de Transação ---

/** Abre e preenche o modal de edição com os dados da transação. */
export function openEditModal(transaction) {
    editTransactionIdInput.value = transaction.id;
    editTransactionDescriptionInput.value = transaction.description;
    editTransactionAmountInput.value = transaction.amount;
    editTransactionDateInput.value = formatDateToInput(transaction.date);
    document.querySelector(`input[name="edit-transaction-type"][value="${transaction.type}"]`).checked = true;

    render.populateCategorySelects(transaction.type, editTransactionCategorySelect);
    editTransactionCategorySelect.value = transaction.category;

    editPaymentMethodSelect.value = transaction.paymentMethod;
    editCreditCardWrapper.style.display = transaction.paymentMethod === 'credit_card' ? 'block' : 'none';

    editModal.style.display = 'flex';
}

/** Fecha o modal de edição de transação. */
export function closeEditModal() {
    editModal.style.display = 'none';
}

// INÍCIO DA ALTERAÇÃO - Novas funções para o modal de edição de recorrência

/** Abre e preenche o modal de edição com os dados da recorrência. */
export function openEditRecurringModal(recurringTx) {
    editRecurringIdInput.value = recurringTx.id;
    editRecurringDescriptionInput.value = recurringTx.description;
    editRecurringAmountInput.value = recurringTx.amount;
    editRecurringDayInput.value = recurringTx.dayOfMonth;
    document.querySelector(`input[name="edit-recurring-type"][value="${recurringTx.type}"]`).checked = true;

    // Popula as categorias e define o valor correto
    render.populateCategorySelects(recurringTx.type, editRecurringCategorySelect);
    editRecurringCategorySelect.value = recurringTx.category;

    editRecurringModal.style.display = 'flex';
}

/** Fecha o modal de edição de recorrência. */
export function closeEditRecurringModal() {
    editRecurringModal.style.display = 'none';
}
// FIM DA ALTERAÇÃO


// --- Funções de Gerenciamento do Modal de Cartões ---

/** Abre o modal de gerenciamento de cartões. */
export function openCardModal() {
    showCardManagementView();
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
            displayInvoiceDetails(invoices[0]);
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

// INÍCIO DA ALTERAÇÃO - A função agora busca os dados antes de renderizar.
/** Abre o modal de configurações, busca os dados necessários e renderiza as listas. */
export async function openSettingsModal() {
    if (!state.currentUser) return;

    // Define o estado de carregamento nas listas
    document.getElementById('recurring-list').innerHTML = '<li>Carregando...</li>';
    if (state.currentUserProfile.role === 'admin') {
        document.getElementById('user-list').innerHTML = '<li>Carregando...</li>';
    }

    // Exibe o modal imediatamente para o usuário ver o carregamento
    settingsModal.style.display = 'flex';
    
    try {
        // Busca os dados das recorrências
        const recurringTxs = await getRecurringTransactions(state.currentUser.uid);
        state.setUserRecurringTransactions(recurringTxs);
        render.renderRecurringList(); // Renderiza com os dados buscados

        // Se for admin, busca os dados dos usuários
        if (state.currentUserProfile.role === 'admin') {
            adminTabButton.style.display = 'block';
            const users = await getAllUsers();
            render.renderUserList(users); // Passa os dados para a função de renderização
        }

        // Renderiza as outras listas que dependem de estado já carregado
        render.renderBudgetList();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}
// FIM DA ALTERAÇÃO

/** Fecha o modal de configurações. */
export function closeSettingsModal() {
    settingsModal.style.display = 'none';
}
