// js/modules/investments/handlers.js

/**
 * Módulo para gerenciar todos os event listeners e handlers
 * específicos da "página" de investimentos.
 */

import * as state from '../state.js';
import * as portfolios from './portfolios.js';
import * as assets from './assets.js';
import * as movements from './movements.js';
import * as investmentsUI from './ui.js';
import { showNotification } from '../ui/notifications.js';
import { loadUserDashboard, loadUserAccounts } from '../../app.js';

// --- Seleção de Elementos do DOM ---
const addPortfolioForm = document.getElementById('add-portfolio-form');
const portfoliosList = document.getElementById('portfolios-list');
const addAssetForm = document.getElementById('add-asset-form');
const backToPortfoliosButton = document.getElementById('back-to-portfolios-button');
const assetList = document.getElementById('asset-list');
const closeMovementModalButton = document.querySelector('.close-asset-movement-modal-button');
const addMovementForm = document.getElementById('add-movement-form');
const goToPortfoliosManagementBtn = document.getElementById('go-to-portfolios-management-btn');
// INÍCIO DA ALTERAÇÃO
const closeProventoModalButton = document.querySelector('.close-provento-modal-button');
const addProventoForm = document.getElementById('add-provento-form');
// FIM DA ALTERAÇÃO


/**
 * Inicializa todos os event listeners do módulo de investimentos.
 */
export function initializeInvestmentEventListeners() {
    addPortfolioForm.addEventListener('submit', handleAddPortfolio);
    portfoliosList.addEventListener('click', handlePortfolioListActions);
    addAssetForm.addEventListener('submit', handleAddAsset);
    backToPortfoliosButton.addEventListener('click', investmentsUI.showPortfoliosView);
    assetList.addEventListener('click', handleAssetListActions);
    closeMovementModalButton.addEventListener('click', investmentsUI.closeMovementModal);
    addMovementForm.addEventListener('submit', handleAddMovement);
    goToPortfoliosManagementBtn.addEventListener('click', (e) => {
        e.preventDefault();
        investmentsUI.showPortfoliosManagementView();
    });
    // INÍCIO DA ALTERAÇÃO
    closeProventoModalButton.addEventListener('click', investmentsUI.closeProventoModal);
    addProventoForm.addEventListener('submit', handleAddProvento);
    // FIM DA ALTERAÇÃO
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


/**
 * Handler para ações na lista de ativos (ex: excluir, adicionar movimento).
 */
async function handleAssetListActions(e) {
    const deleteButton = e.target.closest('.delete-btn[data-asset-id]');
    const addMovementButton = e.target.closest('.add-movement-btn[data-asset-id]');
    // INÍCIO DA ALTERAÇÃO
    const addProventoButton = e.target.closest('.add-provento-btn[data-asset-id]');
    // FIM DA ALTERAÇÃO
    
    if (deleteButton) {
        e.stopPropagation();
        const assetId = deleteButton.dataset.assetId;
        const selectedPortfolio = state.selectedPortfolioForAssetsView;

        if (!selectedPortfolio) {
            showNotification("Erro: Carteira não identificada.", "error");
            return;
        }

        if (confirm(`Tem certeza que deseja excluir este ativo? Todos os seus movimentos registrados também serão perdidos.`)) {
            try {
                await assets.deleteAsset(selectedPortfolio.id, assetId);
                showNotification('Ativo excluído com sucesso!');
                await investmentsUI.loadAndRenderAssets(selectedPortfolio.id); // Recarrega a lista
            } catch (error) {
                showNotification(error.message, 'error');
            }
        }
    } else if (addMovementButton) {
        e.stopPropagation();
        const assetId = addMovementButton.dataset.assetId;
        investmentsUI.openMovementModal(assetId);
    // INÍCIO DA ALTERAÇÃO
    } else if (addProventoButton) {
        e.stopPropagation();
        const assetId = addProventoButton.dataset.assetId;
        investmentsUI.openProventoModal(assetId);
    }
    // FIM DA ALTERAÇÃO
}

/**
 * Handler para o formulário de adicionar um novo movimento (compra/venda).
 */
async function handleAddMovement(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const selectedPortfolio = state.selectedPortfolioForAssetsView;
    const assetId = form['movement-asset-id'].value;

    if (!selectedPortfolio || !assetId) {
        showNotification("Erro: Carteira ou ativo não identificado.", "error");
        submitButton.disabled = false;
        return;
    }
    
    const movementData = {
        type: form['movement-type'].value,
        date: form['movement-date'].value,
        quantity: parseFloat(form['movement-quantity'].value),
        price: parseFloat(form['movement-price'].value),
        accountId: form['movement-account'].value,
        userId: state.currentUser.uid
    };

    try {
        await movements.addMovement(selectedPortfolio.id, assetId, movementData);
        showNotification("Operação registrada com sucesso!");
        investmentsUI.closeMovementModal();
        
        // Atualiza a UI para refletir as mudanças
        await investmentsUI.loadAndRenderAssets(selectedPortfolio.id);
        await loadUserDashboard(); // Recarrega o dashboard para atualizar os totais
        await loadUserAccounts(); // Recarrega as contas para atualizar os saldos

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

// INÍCIO DA ALTERAÇÃO
/**
 * Handler para o formulário de adicionar um novo provento.
 */
async function handleAddProvento(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const selectedPortfolio = state.selectedPortfolioForAssetsView;
    const assetId = form['provento-asset-id'].value;

    if (!selectedPortfolio || !assetId) {
        showNotification("Erro: Carteira ou ativo não identificado para registrar o provento.", "error");
        submitButton.disabled = false;
        return;
    }

    const proventoData = {
        proventoType: form['provento-type'].value,
        paymentDate: form['provento-payment-date'].value,
        totalAmount: parseFloat(form['provento-total-amount'].value),
        accountId: form['provento-account'].value,
        userId: state.currentUser.uid,
    };

    try {
        await movements.addProvento(selectedPortfolio.id, assetId, proventoData);
        showNotification("Provento registrado com sucesso!");
        investmentsUI.closeProventoModal();
        
        // Atualiza as telas para refletir a nova receita
        await investmentsUI.loadInvestmentDashboard(); // Atualiza o dashboard de investimentos
        await loadUserDashboard(); // Atualiza o dashboard principal
        await loadUserAccounts();  // Atualiza os saldos das contas

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}
// FIM DA ALTERAÇÃO
