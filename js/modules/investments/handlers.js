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
const closeProventoModalButton = document.querySelector('.close-provento-modal-button');
const addProventoForm = document.getElementById('add-provento-form');
const backToAssetsButton = document.getElementById('back-to-assets-button');
const movementsList = document.getElementById('movements-list');

// Formulários de Edição de Investimentos
const editPortfolioForm = document.getElementById('edit-portfolio-form');
const editAssetForm = document.getElementById('edit-asset-form');
const editMovementForm = document.getElementById('edit-movement-form');


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
    closeProventoModalButton.addEventListener('click', investmentsUI.closeProventoModal);
    addProventoForm.addEventListener('submit', handleAddProvento);

    backToAssetsButton.addEventListener('click', (e) => {
        e.preventDefault();
        investmentsUI.showAssetsView(state.selectedPortfolioForAssetsView);
    });

    document.querySelector('.close-edit-portfolio-modal-button').addEventListener('click', investmentsUI.closeEditPortfolioModal);
    document.querySelector('.close-edit-asset-modal-button').addEventListener('click', investmentsUI.closeEditAssetModal);
    document.querySelector('.close-edit-movement-modal-button').addEventListener('click', investmentsUI.closeEditMovementModal);

    editPortfolioForm.addEventListener('submit', handleUpdatePortfolio);
    editAssetForm.addEventListener('submit', handleUpdateAsset);
    editMovementForm.addEventListener('submit', handleUpdateMovement);

    movementsList.addEventListener('click', handleMovementsListActions);
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
 * Handler para ações na lista de carteiras (excluir/visualizar/editar).
 */
async function handlePortfolioListActions(e) {
    const deleteButton = e.target.closest('.delete-btn[data-portfolio-id]');
    const infoArea = e.target.closest('.portfolio-info[data-portfolio-id]');
    const editButton = e.target.closest('.edit-btn[data-portfolio-id]');

    if (editButton) {
        e.stopPropagation();
        const portfolioId = editButton.dataset.portfolioId;
        investmentsUI.openEditPortfolioModal(portfolioId);
    }
    else if (deleteButton) {
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
 * Handler para ações na lista de ativos.
 */
async function handleAssetListActions(e) {
    const deleteButton = e.target.closest('.delete-btn[data-asset-id]');
    const addMovementButton = e.target.closest('.add-movement-btn[data-asset-id]');
    const addProventoButton = e.target.closest('.add-provento-btn[data-asset-id]');
    const assetInfo = e.target.closest('.asset-info[data-asset-id]');
    // INÍCIO DA ALTERAÇÃO
    const editButton = e.target.closest('.edit-btn[data-asset-id]');

    if (editButton) {
        e.stopPropagation();
        const assetId = editButton.dataset.assetId;
        investmentsUI.openEditAssetModal(assetId);
    }
    // FIM DA ALTERAÇÃO
    else if (deleteButton) {
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
                await investmentsUI.loadAndRenderAssets(selectedPortfolio.id);
            } catch (error) {
                showNotification(error.message, 'error');
            }
        }
    } else if (addMovementButton) {
        e.stopPropagation();
        const assetId = addMovementButton.dataset.assetId;
        investmentsUI.openMovementModal(assetId);
    } else if (addProventoButton) {
        e.stopPropagation();
        const assetId = addProventoButton.dataset.assetId;
        investmentsUI.openProventoModal(assetId);
    } else if (assetInfo) {
        const assetId = assetInfo.dataset.assetId;
        investmentsUI.showMovementsView(assetId);
    }
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
        
        await investmentsUI.loadAndRenderAssets(selectedPortfolio.id);
        await loadUserDashboard();
        await loadUserAccounts();

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

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
        
        await investmentsUI.loadInvestmentDashboard();
        await loadUserDashboard();
        await loadUserAccounts();

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

// --- Handlers do CRUD de Investimentos ---

async function handleUpdatePortfolio(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const portfolioId = form['edit-portfolio-id'].value;
    const updatedData = {
        name: form['edit-portfolio-name'].value,
        description: form['edit-portfolio-description'].value,
    };

    try {
        await portfolios.updatePortfolio(portfolioId, updatedData);
        showNotification("Carteira atualizada com sucesso!");
        investmentsUI.closeEditPortfolioModal();
        await investmentsUI.loadAndRenderPortfolios();
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

// INÍCIO DA ALTERAÇÃO
async function handleUpdateAsset(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const portfolioId = state.selectedPortfolioForAssetsView.id;
    const assetId = form['edit-asset-id'].value;
    
    const updatedData = {
        name: form['edit-asset-name'].value,
        ticker: form['edit-asset-ticker'].value.toUpperCase(),
        type: form['edit-asset-type'].value,
        assetClass: form['edit-asset-class'].value,
        broker: form['edit-asset-broker'].value,
    };

    try {
        await assets.updateAsset(portfolioId, assetId, updatedData);
        showNotification("Ativo atualizado com sucesso!");
        investmentsUI.closeEditAssetModal();
        await investmentsUI.loadAndRenderAssets(portfolioId);
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}
// FIM DA ALTERAÇÃO

function handleUpdateMovement(e) {
    e.preventDefault();
    showNotification("Lógica de salvar edição de movimento pendente.", "info");
}

function handleMovementsListActions(e) {
    const editButton = e.target.closest('.edit-btn[data-movement-id]');
    const deleteButton = e.target.closest('.delete-btn[data-movement-id]');

    if (editButton) {
        const movementId = editButton.dataset.movementId;
        investmentsUI.openEditMovementModal(movementId);
    }

    if (deleteButton) {
        const movementId = deleteButton.dataset.movementId;
        if (confirm("Tem certeza que deseja excluir esta operação? Esta ação é irreversível.")) {
            showNotification(`Lógica para excluir movimento ${movementId} pendente.`, "info");
        }
    }
}
