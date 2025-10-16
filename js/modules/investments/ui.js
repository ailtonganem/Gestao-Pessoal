// js/modules/investments/ui.js

/**
 * Módulo para gerenciar a interface do usuário (UI) do modal de investimentos.
 * Controla a abertura, fechamento, troca de visualizações e renderização de dados.
 */

import * as state from '../state.js';
import * as portfolios from './portfolios.js';
import * as assets from './assets.js';
import { showNotification } from '../ui/notifications.js';
import { formatCurrency } from '../ui/utils.js';

// --- Seleção de Elementos do DOM ---
const portfoliosView = document.getElementById('portfolios-view');
const assetsView = document.getElementById('assets-view');
const portfoliosListEl = document.getElementById('portfolios-list');
const assetsPortfolioNameEl = document.getElementById('assets-portfolio-name');
const assetListEl = document.getElementById('asset-list');


/**
 * Exibe a visualização principal de gerenciamento de carteiras.
 */
export function showPortfoliosView() {
    portfoliosView.style.display = 'block';
    assetsView.style.display = 'none';
    state.setSelectedPortfolioForAssetsView(null); // Limpa a seleção ao voltar
}

/**
 * Exibe a visualização de gerenciamento de ativos para uma carteira específica.
 * @param {object} portfolio - O objeto da carteira selecionada.
 */
export async function showAssetsView(portfolio) {
    state.setSelectedPortfolioForAssetsView(portfolio); // Guarda a carteira selecionada no estado
    assetsPortfolioNameEl.textContent = `Ativos - ${portfolio.name}`;
    portfoliosView.style.display = 'none';
    assetsView.style.display = 'block';
    await loadAndRenderAssets(portfolio.id); // Carrega e exibe os ativos da carteira
}

/**
 * Busca os dados das carteiras do Firestore e chama a função para renderizá-los.
 */
export async function loadAndRenderPortfolios() {
    portfoliosListEl.innerHTML = '<li>Carregando carteiras...</li>';
    try {
        const userPortfolios = await portfolios.getPortfolios(state.currentUser.uid);
        state.setUserPortfolios(userPortfolios); // Salva as carteiras no estado global
        renderPortfolios(userPortfolios);
    } catch (error) {
        showNotification(error.message, 'error');
        portfoliosListEl.innerHTML = '<li>Erro ao carregar carteiras.</li>';
    }
}

/**
 * Renderiza a lista de carteiras de investimento.
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
        // INÍCIO DA ALTERAÇÃO - Uso de classes CSS em vez de estilos inline
        li.className = 'portfolio-item';
        
        const totalValue = portfolio.currentValue || 0;

        li.innerHTML = `
            <div class="portfolio-info" data-portfolio-id="${portfolio.id}">
                <span class="portfolio-name">${portfolio.name}</span>
                <small class="portfolio-description">${portfolio.description || 'Sem descrição'}</small>
            </div>
            <div class="portfolio-summary">
                <span class="portfolio-value">${formatCurrency(totalValue)}</span>
                <div class="portfolio-actions">
                    <button class="action-btn edit-btn" data-portfolio-id="${portfolio.id}" title="Editar Carteira">&#9998;</button>
                    <button class="action-btn delete-btn" data-portfolio-id="${portfolio.id}" title="Excluir Carteira">&times;</button>
                </div>
            </div>
        `;
        // FIM DA ALTERAÇÃO
        portfoliosListEl.appendChild(li);
    });
}


// Novas funções para carregar e renderizar ativos

/**
 * Busca os dados dos ativos de uma carteira e chama a função para renderizá-los.
 * @param {string} portfolioId - O ID da carteira da qual carregar os ativos.
 */
export async function loadAndRenderAssets(portfolioId) {
    assetListEl.innerHTML = '<li>Carregando ativos...</li>';
    try {
        const userAssets = await assets.getAssets(portfolioId);
        // Futuramente, salvar no estado: state.setCurrentPortfolioAssets(userAssets);
        renderAssets(userAssets);
    } catch (error) {
        showNotification(error.message, 'error');
        assetListEl.innerHTML = '<li>Erro ao carregar ativos.</li>';
    }
}

/**
 * Renderiza a lista de ativos de uma carteira.
 * @param {Array<object>} assetsToRender - A lista de ativos.
 */
function renderAssets(assetsToRender) {
    assetListEl.innerHTML = '';
    if (assetsToRender.length === 0) {
        assetListEl.innerHTML = '<li>Nenhum ativo cadastrado. Adicione um no formulário abaixo.</li>';
        return;
    }

    assetsToRender.forEach(asset => {
        const li = document.createElement('li');
        // INÍCIO DA ALTERAÇÃO - Uso de classes CSS em vez de estilos inline
        li.className = 'asset-item';

        li.innerHTML = `
            <div class="asset-info">
                <span class="asset-ticker">${asset.ticker}</span>
                <span class="asset-name">${asset.name}</span>
                <small class="asset-type">${asset.type} - ${asset.broker}</small>
            </div>
            <div class="asset-summary">
                <span class="asset-value">${formatCurrency(asset.currentValue)}</span>
                <small class="asset-quantity">${asset.quantity} Cotas</small>
            </div>
            <div class="asset-actions">
                <button class="action-btn" data-asset-id="${asset.id}" title="Adicionar Movimento (Compra/Venda)">➕</button>
                <button class="action-btn edit-btn" data-asset-id="${asset.id}" title="Editar Ativo">&#9998;</button>
                <button class="action-btn delete-btn" data-asset-id="${asset.id}" title="Excluir Ativo">&times;</button>
            </div>
        `;
        // FIM DA ALTERAÇÃO
        assetListEl.appendChild(li);
    });
}
