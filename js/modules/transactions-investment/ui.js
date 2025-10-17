// js/modules/transactions-investment/ui.js

/**
 * Módulo para gerenciar a interface do usuário (UI) da página de Transações de Investimentos.
 */

import * as state from '../state.js';
import * as movements from '../investments/movements.js';
import { showNotification } from '../ui/notifications.js';
import { formatCurrency } from '../ui/utils.js';

// --- Seleção de Elementos do DOM ---
const transactionsListEl = document.getElementById('transactions-investment-list');

/**
 * Ponto de entrada principal para carregar e renderizar a página de transações de investimentos.
 */
export async function loadTransactionsPage() {
    transactionsListEl.innerHTML = '<li>Carregando transações...</li>';

    try {
        const allTransactions = await movements.getAllInvestmentTransactions(state.currentUser.uid);
        renderTransactionsList(allTransactions);
    } catch (error) {
        showNotification(error.message, 'error');
        transactionsListEl.innerHTML = '<li>Erro ao carregar transações.</li>';
    }
}

/**
 * Renderiza a lista de transações de investimento na tabela.
 * @param {Array<object>} transactions - A lista de transações a serem exibidas.
 */
function renderTransactionsList(transactions) {
    transactionsListEl.innerHTML = '';

    if (transactions.length === 0) {
        transactionsListEl.innerHTML = '<li>Nenhuma transação de compra ou venda encontrada.</li>';
        return;
    }

    transactions.forEach(tx => {
        const li = document.createElement('li');
        li.className = 'movement-item'; // Reutiliza o estilo dos itens de movimento

        const typeLabel = tx.type === 'buy' ? 'Compra' : 'Venda';
        const typeClass = tx.type;

        li.innerHTML = `
            <div>${tx.date.toLocaleDateString('pt-BR')}</div>
            <div>
                <span class="asset-ticker">${tx.ticker || 'N/A'}</span>
            </div>
            <div><span class="status-badge ${typeClass}">${typeLabel}</span></div>
            <div class="numeric">${tx.quantity}</div>
            <div class="numeric">${formatCurrency(tx.pricePerUnit)}</div>
            <div class="numeric">${formatCurrency(tx.totalCost)}</div>
            <div class="actions">
                <button class="action-btn edit-btn" data-movement-id="${tx.id}" title="Editar (Em breve)" disabled>&#9998;</button>
                <button class="action-btn delete-btn" data-movement-id="${tx.id}" title="Excluir (Em breve)" disabled>&times;</button>
            </div>
        `;
        transactionsListEl.appendChild(li);
    });
}
