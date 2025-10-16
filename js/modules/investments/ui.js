// js/modules/investments/ui.js

/**
 * Módulo para gerenciar a interface do usuário (UI) do modal de investimentos.
 * Controla a abertura, fechamento, troca de visualizações e renderização de dados.
 */

import * as state from '../state.js';
import * as portfolios from './portfolios.js';
import { showNotification } from '../ui/notifications.js';
import { formatCurrency } from '../ui/utils.js';

// --- Seleção de Elementos do DOM ---
const investmentsModal = document.getElementById('investments-modal');
const portfoliosView = document.getElementById('portfolios-view');
const assetsView = document.getElementById('assets-view');
const portfoliosListEl = document.getElementById('portfolios-list');
const assetsPortfolioNameEl = document.getElementById('assets-portfolio-name');

/**
 * Abre o modal de investimentos e carrega a lista de carteiras.
 */
export async function openInvestmentsModal() {
    if (!state.currentUser) return;
    
    showPortfoliosView();
    investmentsModal.style.display = 'flex';
    await loadAndRenderPortfolios();
}

/**
 * Fecha o modal de investimentos.
 */
export function closeInvestmentsModal() {
    investmentsModal.style.display = 'none';
}

/**
 * Exibe a visualização principal de gerenciamento de carteiras.
 */
export function showPortfoliosView() {
    portfoliosView.style.display = 'block';
    assetsView.style.display = 'none';
}

/**
 * Exibe a visualização de gerenciamento de ativos para uma carteira específica.
 * @param {object} portfolio - O objeto da carteira selecionada.
 */
export function showAssetsView(portfolio) {
    assetsPortfolioNameEl.textContent = `Ativos - ${portfolio.name}`;
    portfoliosView.style.display = 'none';
    assetsView.style.display = 'block';
    // Futuramente, aqui chamaremos a função para carregar e renderizar os ativos desta carteira.
}

/**
 * Busca os dados das carteiras do Firestore e chama a função para renderizá-los.
 */
async function loadAndRenderPortfolios() {
    portfoliosListEl.innerHTML = '<li>Carregando carteiras...</li>';
    try {
        const userPortfolios = await portfolios.getPortfolios(state.currentUser.uid);
        // Armazenar no estado global se necessário no futuro
        // state.setUserPortfolios(userPortfolios); 
        renderPortfolios(userPortfolios);
    } catch (error) {
        showNotification(error.message, 'error');
        portfoliosListEl.innerHTML = '<li>Erro ao carregar carteiras.</li>';
    }
}

/**
 * Renderiza a lista de carteiras de investimento no modal.
 * @param {Array<object>} portfoliosToRender - A lista de carteiras.
 */
function renderPortfolios(portfoliosToRender) {
    portfoliosListEl.innerHTML = '';

    if (portfoliosToRender.length === 0) {
        portfoliosListEl.innerHTML = '<li>Nenhuma carteira criada. Crie uma abaixo.</li>';
        return;
    }

    portfoliosToRender.forEach(portfolio => {
        const li = document.createElement('li');
        // Adicionaremos classes e estilos melhores para isso no futuro.
        li.style.cssText = 'background-color: var(--background-color); padding: 1rem; margin-bottom: 0.5rem; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;';
        
        const totalValue = portfolio.currentValue || 0;

        li.innerHTML = `
            <div class="portfolio-info" data-portfolio-id="${portfolio.id}" style="flex-grow: 1; cursor: pointer; text-align: left;">
                <span style="font-weight: bold; display: block;">${portfolio.name}</span>
                <small>${portfolio.description || 'Sem descrição'}</small>
            </div>
            <div style="text-align: right;">
                <span style="font-weight: bold; font-size: 1.1rem; display: block;">${formatCurrency(totalValue)}</span>
                <div class="portfolio-actions" style="margin-top: 0.5rem;">
                    <button class="action-btn edit-btn" data-portfolio-id="${portfolio.id}" title="Editar Carteira">&#9998;</button>
                    <button class="action-btn delete-btn" data-portfolio-id="${portfolio.id}" title="Excluir Carteira">&times;</button>
                </div>
            </div>
        `;
        portfoliosListEl.appendChild(li);
    });
}
