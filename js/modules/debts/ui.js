// js/modules/debts/ui.js

/**
 * Módulo para gerenciar a interface do usuário (UI) da página de Dívidas.
 */

import * as state from '../state.js';
import * as debts from '../debts.js';
import { showNotification } from '../ui/notifications.js';
import { formatCurrency } from '../ui/utils.js';
import { populateCategorySelects } from '../ui/render.js';

// --- Seleção de Elementos do DOM ---
const debtListEl = document.getElementById('debt-list');
const totalDebtBalanceEl = document.getElementById('total-debt-balance');
const debtCategorySelect = document.getElementById('debt-category');

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
    totalDebtBalanceEl.textContent = 'Calculando...';
}

/**
 * Popula o select de categorias no formulário de adicionar dívida.
 */
function populateDebtCategorySelect() {
    // Reutiliza a função de renderização de categorias, filtrando por 'expense'.
    populateCategorySelects('expense', debtCategorySelect);
}

/**
 * Renderiza o card de resumo com o saldo devedor total.
 * @param {Array<object>} userDebts - A lista de dívidas do usuário.
 */
function renderDebtsSummary(userDebts) {
    const totalBalance = userDebts
        .filter(debt => debt.status === 'active')
        .reduce((sum, debt) => sum + (debt.totalAmount - debt.amountPaid), 0);
    
    totalDebtBalanceEl.textContent = formatCurrency(totalBalance);
}

/**
 * Renderiza a lista de dívidas com suas barras de progresso e botões de ação.
 * @param {Array<object>} userDebts - A lista de dívidas a serem exibidas.
 */
function renderDebtsList(userDebts) {
    debtListEl.innerHTML = '';

    if (userDebts.length === 0) {
        debtListEl.innerHTML = '<li>Nenhuma dívida cadastrada. Adicione uma no formulário abaixo.</li>';
        return;
    }

    userDebts.forEach(debt => {
        const li = document.createElement('li');
        li.className = `debt-item ${debt.status === 'paid' ? 'paid' : ''}`;
        
        const remainingBalance = debt.totalAmount - debt.amountPaid;
        const percentage = debt.totalAmount > 0 ? (debt.amountPaid / debt.totalAmount) * 100 : 0;
        const cappedPercentage = Math.min(percentage, 100);

        const actionsHtml = debt.status === 'active'
            ? `<button class="button-secondary pay-installment-btn" data-debt-id="${debt.id}">Pagar Parcela</button>`
            : `<span class="status-badge paid">Quitado!</span>`;

        li.innerHTML = `
            <div class="debt-item-header">
                <span>${debt.description}</span>
                <span class="debt-item-values">
                    ${formatCurrency(debt.amountPaid)} / ${formatCurrency(debt.totalAmount)}
                </span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar safe" style="width: ${cappedPercentage}%; background-color: var(--secondary-color);">${Math.round(percentage)}%</div>
            </div>
            <div class="debt-item-details" style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.9rem;">
                <span>Parcela: <strong>${formatCurrency(debt.installmentAmount)}</strong></span>
                <span>Saldo Devedor: <strong>${formatCurrency(remainingBalance)}</strong></span>
            </div>
            <div class="debt-item-actions">
                ${actionsHtml}
            </div>
        `;
        debtListEl.appendChild(li);
    });
}
