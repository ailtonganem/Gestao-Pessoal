// js/modules/debts/ui.js

/**
 * Módulo para gerenciar a interface do usuário (UI) da página de Dívidas.
 */

import * as state from '../state.js';
import * as debts from '../debts.js';
import { showNotification } from '../ui/notifications.js';
import { formatCurrency } from '../ui/utils.js';
import { populateCategorySelects } from '../ui/render.js';
import { renderDebtEvolutionChart, renderDebtCompositionChart } from '../ui/charts.js';

// --- Seleção de Elementos do DOM ---
const debtListEl = document.getElementById('debt-list');
const totalDebtBalanceEl = document.getElementById('total-debt-balance');
const debtCategorySelect = document.getElementById('debt-category');

const nextDueDateEl = document.getElementById('next-due-date');
const totalPaidThisMonthEl = document.getElementById('total-paid-this-month');
const debtDetailsModal = document.getElementById('debt-details-modal');
const debtDetailsDescriptionEl = document.getElementById('debt-details-description');
const debtDetailsBalanceEl = document.getElementById('debt-details-balance');
const debtDetailsProgressEl = document.getElementById('debt-details-progress');
const debtDetailsInfoGridEl = document.getElementById('debt-details-info-grid');
const debtDetailsPaymentListEl = document.getElementById('debt-details-payment-list');

const paidDebtListEl = document.getElementById('paid-debt-list');


/**
 * Ponto de entrada principal para carregar e renderizar a página de dívidas.
 */
export async function loadDebtsPage() {
    renderLoadingPlaceholders();
    populateDebtCategorySelect();

    try {
        const userDebts = await debts.getDebts(state.currentUser.uid);
        state.setUserDebts(userDebts);
        
        renderDebtsSummary(userDebts);
        renderDebtsList(userDebts);

        // Gera e renderiza os gráficos
        const evolutionData = await debts.getDebtEvolutionData(state.currentUser.uid, state.allTransactions);
        renderDebtEvolutionChart(evolutionData);
        
        const compositionData = debts.getDebtCompositionData(userDebts);
        renderDebtCompositionChart(compositionData);

    } catch (error) {
        showNotification(error.message, 'error');
        debtListEl.innerHTML = '<li>Erro ao carregar as dívidas.</li>';
        totalDebtBalanceEl.textContent = 'Erro';
    }
}

/**
 * Exibe placeholders de "Carregando..." enquanto os dados são buscados.
 */
function renderLoadingPlaceholders() {
    debtListEl.innerHTML = '<li>Carregando dívidas...</li>';
    paidDebtListEl.innerHTML = '<li>Carregando histórico...</li>';
    totalDebtBalanceEl.textContent = 'Calculando...';
    nextDueDateEl.textContent = '...';
    totalPaidThisMonthEl.textContent = '...';
}

/**
 * Popula o select de categorias no formulário de adicionar dívida.
 */
function populateDebtCategorySelect() {
    populateCategorySelects('expense', debtCategorySelect);
}

/**
 * Renderiza os cards de resumo com os dados calculados.
 * @param {Array<object>} userDebts - A lista de dívidas do usuário.
 */
function renderDebtsSummary(userDebts) {
    const activeDebts = userDebts.filter(debt => debt.status === 'active');
    
    const totalBalance = activeDebts.reduce((sum, debt) => sum + (debt.totalAmount - debt.amountPaid), 0);
    totalDebtBalanceEl.textContent = formatCurrency(totalBalance);

    const upcomingPayments = activeDebts.map(debt => {
        const nextPaymentDate = new Date(debt.startDate);
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + (debt.installmentsPaid || 0));
        return nextPaymentDate;
    }).filter(date => date >= new Date());

    if (upcomingPayments.length > 0) {
        const nextDueDate = new Date(Math.min.apply(null, upcomingPayments));
        nextDueDateEl.textContent = nextDueDate.toLocaleDateString('pt-BR');
    } else {
        nextDueDateEl.textContent = 'N/A';
    }
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const paidThisMonth = state.allTransactions
        .filter(t => 
            t.description.startsWith('Pagamento Parcela -') &&
            t.date.getMonth() === currentMonth &&
            t.date.getFullYear() === currentYear
        )
        .reduce((sum, t) => sum + t.amount, 0);

    totalPaidThisMonthEl.textContent = formatCurrency(paidThisMonth);
}

/**
 * Renderiza as listas de dívidas ativas e quitadas em suas respectivas abas.
 * @param {Array<object>} userDebts - A lista completa de dívidas do usuário.
 */
function renderDebtsList(userDebts) {
    const activeDebts = userDebts.filter(debt => debt.status !== 'paid');
    const paidDebts = userDebts.filter(debt => debt.status === 'paid');

    debtListEl.innerHTML = '';
    paidDebtListEl.innerHTML = '';

    if (activeDebts.length === 0) {
        debtListEl.innerHTML = '<li>Nenhuma dívida ativa no momento.</li>';
    } else {
        activeDebts.forEach(debt => {
            debtListEl.innerHTML += createDebtListItemHTML(debt);
        });
    }

    if (paidDebts.length === 0) {
        paidDebtListEl.innerHTML = '<li>Nenhuma dívida quitada encontrada.</li>';
    } else {
        paidDebts.forEach(debt => {
            paidDebtListEl.innerHTML += createDebtListItemHTML(debt);
        });
    }
}

/**
 * Cria o HTML para um item da lista de dívidas.
 * @param {object} debt - O objeto da dívida.
 * @returns {string} O HTML do elemento <li>.
 */
function createDebtListItemHTML(debt) {
    const remainingBalance = debt.totalAmount - (debt.amountPaid || 0);
    const percentage = debt.totalAmount > 0 ? ((debt.amountPaid || 0) / debt.totalAmount) * 100 : 0;
    const cappedPercentage = Math.min(percentage, 100);

    const actionsHtml = debt.status === 'active'
        ? `<button class="button-secondary details-btn" data-debt-id="${debt.id}">Detalhes</button>
           <button class="button-primary pay-installment-btn" data-debt-id="${debt.id}">Pagar Parcela</button>`
        : `<button class="button-secondary details-btn" data-debt-id="${debt.id}">Detalhes</button>
           <span class="status-badge paid">Quitado!</span>`;

    return `
        <li class="debt-item ${debt.status === 'paid' ? 'paid' : ''}">
            <div class="debt-item-header">
                <span>${debt.description}</span>
                <span class="debt-item-values">
                    ${debt.installmentsPaid || 0} / ${debt.totalInstallments} parcelas pagas
                </span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar safe" style="width: ${cappedPercentage}%; background-color: var(--secondary-color);">${Math.round(percentage)}%</div>
            </div>
            <div class="debt-item-details">
                <span>Parcela: <strong>${formatCurrency(debt.installmentAmount)}</strong></span>
                <span>Saldo Devedor: <strong>${formatCurrency(remainingBalance)}</strong></span>
            </div>
            <div class="debt-item-actions">
                ${actionsHtml}
            </div>
        </li>
    `;
}

/**
 * Gerencia a troca de abas entre "Ativas" e "Quitadas".
 * @param {string} tabId - O ID da aba a ser ativada.
 */
export function switchDebtTab(tabId) {
    document.querySelectorAll('.debt-tab-content').forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
    });

    document.querySelectorAll('#debt-tabs-container .tab-link').forEach(button => {
        button.classList.remove('active');
    });

    const activeContent = document.getElementById(`${tabId}-content`);
    const activeButton = document.querySelector(`#debt-tabs-container .tab-link[data-debt-tab="${tabId}"]`);

    if (activeContent) {
        activeContent.style.display = 'block';
        activeContent.classList.add('active');
    }
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

/**
 * Abre o modal de detalhes de uma dívida específica.
 * @param {string} debtId - O ID da dívida a ser detalhada.
 */
export function openDebtDetailsModal(debtId) {
    const debt = state.userDebts.find(d => d.id === debtId);
    if (!debt) {
        showNotification("Dívida não encontrada.", "error");
        return;
    }

    renderDebtDetails(debt);
    debtDetailsModal.style.display = 'flex';
}

/**
 * Fecha o modal de detalhes da dívida.
 */
export function closeDebtDetailsModal() {
    debtDetailsModal.style.display = 'none';
}

/**
 * Preenche o modal com todas as informações da dívida.
 * @param {object} debt - O objeto da dívida.
 */
function renderDebtDetails(debt) {
    debtDetailsDescriptionEl.textContent = debt.description;

    const remainingBalance = debt.totalAmount - (debt.amountPaid || 0);
    debtDetailsBalanceEl.textContent = formatCurrency(remainingBalance);
    debtDetailsProgressEl.textContent = `${debt.installmentsPaid || 0} / ${debt.totalInstallments} parcelas`;

    renderDebtDetailsInfo(debt);
    renderDebtPaymentHistory(debt);
}

/**
 * Renderiza a grade de informações estáticas da dívida.
 * @param {object} debt - O objeto da dívida.
 */
function renderDebtDetailsInfo(debt) {
    debtDetailsInfoGridEl.innerHTML = `
        <div><strong>Credor:</strong> ${debt.creditor}</div>
        <div><strong>Tipo:</strong> ${debt.type}</div>
        <div><strong>Data do Contrato:</strong> ${debt.contractDate ? debt.contractDate.toLocaleDateString('pt-BR') : 'N/A'}</div>
        <div><strong>Taxa de Juros:</strong> ${debt.interestRate || 0}% a.m.</div>
        <div><strong>Valor Financiado:</strong> ${formatCurrency(debt.totalAmount)}</div>
        <div><strong>Pagamento:</strong> ${debt.paymentMethod}</div>
    `;
}

/**
 * Renderiza o histórico de pagamentos de uma dívida.
 * @param {object} debt - O objeto da dívida.
 */
function renderDebtPaymentHistory(debt) {
    debtDetailsPaymentListEl.innerHTML = '';
    const paymentTransactions = state.allTransactions.filter(t => 
        t.description === `Pagamento Parcela - ${debt.description}`
    ).sort((a, b) => b.date - a.date);

    if (paymentTransactions.length === 0) {
        debtDetailsPaymentListEl.innerHTML = '<li>Nenhum pagamento registrado.</li>';
        return;
    }

    paymentTransactions.forEach(t => {
        const li = document.createElement('li');
        li.style.cssText = 'display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--background-color);';
        li.innerHTML = `
            <span>${t.date.toLocaleDateString('pt-BR')}</span>
            <span>${formatCurrency(t.amount)}</span>
        `;
        debtDetailsPaymentListEl.appendChild(li);
    });
}
