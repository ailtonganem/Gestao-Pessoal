// js/modules/investments/handlers.js

/**
 * Módulo para gerenciar todos os event listeners e handlers
 * específicos da "página" de investimentos.
 */

import * as state from '../state.js';
import * as portfolios from './portfolios.js';
import * as assets from './assets.js';
import * as investmentsUI from './ui.js';
import { showNotification } from '../ui/notifications.js';

// --- Seleção de Elementos do DOM ---
const addPortfolioForm = document.getElementById('add-portfolio-form');
const portfoliosList = document.getElementById('portfolios-list');
const addAssetForm = document.getElementById('add-asset-form');
const backToPortfoliosButton = document.getElementById('back-to-portfolios-button');

/**
 * Inicializa todos os event listeners do módulo de investimentos.
 */
export function initializeInvestmentEventListeners() {
    addPortfolioForm.addEventListener('submit', handleAddPortfolio);
    portfoliosList.addEventListener('click', handlePortfolioListActions);
    addAssetForm.addEventListener('submit', handleAddAsset);
    backToPortfoliosButton.addEventListener('click', investmentsUI.showPortfoliosView);
}

// --- Funções "Handler" ---

/**
 * Handler para o formulário de adicionar nova carteira.
 */
async function handleAddPortfolio(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const portfolioData = {
        name: form['portfolio-name'].value,
        description: form['portfolio-description'].value,
        userId: state.currentUser.uid,
    };
    
    try {
        await portfolios.addPortfolio(portfolioData);
        showNotification("Carteira criada com sucesso!");
        form.reset();
        await investmentsUI.loadAndRenderPortfolios();
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

/**
 * Handler para ações na lista de carteiras (excluir/visualizar).
 */
async function handlePortfolioListActions(e) {
    const deleteButton = e.target.closest('.delete-btn[data-portfolio-id]');
    const infoArea = e.target.closest('.portfolio-info[data-portfolio-id]');

    if (deleteButton) {
        e.stopPropagation();
        const portfolioId = deleteButton.dataset.portfolioId;
        
        if (confirm(`Tem certeza que deseja excluir esta carteira? Esta ação não pode ser desfeita.`)) {
            try {
                await portfolios.deletePortfolio(portfolioId);
                showNotification('Carteira excluída com sucesso!');
                await investmentsUI.loadAndRenderPortfolios();
            } catch (error) {
                showNotification(error.message, 'error');
            }
        }
    } else if (infoArea) {
        const portfolioId = infoArea.dataset.portfolioId;
        const selectedPortfolio = state.userPortfolios.find(p => p.id === portfolioId);
        if (selectedPortfolio) {
            investmentsUI.showAssetsView(selectedPortfolio);
        }
    }
}

/**
 * Handler para o formulário de adicionar novo ativo.
 */
async function handleAddAsset(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const selectedPortfolio = state.selectedPortfolioForAssetsView;
    if (!selectedPortfolio) {
        showNotification("Nenhuma carteira selecionada. Volte e selecione uma.", "error");
        submitButton.disabled = false;
        return;
    }

    const assetData = {
        name: form['asset-name'].value,
        ticker: form['asset-ticker'].value.toUpperCase(),
        type: form['asset-type'].value,
        assetClass: form['asset-class'].value,
        broker: form['asset-broker'].value,
    };

    try {
        await assets.addAsset(selectedPortfolio.id, assetData);
        showNotification("Ativo adicionado com sucesso!");
        form.reset();
        await investmentsUI.loadAndRenderAssets(selectedPortfolio.id);
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}
