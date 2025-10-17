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
// INÍCIO DA ALTERAÇÃO
import { formatCurrency } from '../ui/utils.js';
// FIM DA ALTERAÇÃO

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
    // INÍCIO DA ALTERAÇÃO
    assetList.addEventListener('input', handleQuoteInputChange);
    // FIM DA ALTERAÇÃO
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

// INÍCIO DA ALTERAÇÃO
/**
 * Handler para o evento de input nos campos de cotação manual.
 * Recalcula os valores do ativo e da carteira toda vez que o usuário altera a cotação.
 * @param {Event} e - O evento de input.
 */
function handleQuoteInputChange(e) {
    if (e.target.classList.contains('quote-input')) {
        const assetId = e.target.dataset.assetId;
        const newPrice = parseFloat(e.target.value);

        // Encontra o ativo no estado local do módulo de UI
        const asset = investmentsUI._currentPortfolioAssets.find(a => a.id === assetId);
        if (!asset || isNaN(newPrice)) {
            return;
        }

        // 1. Atualiza os dados do ativo específico
        asset.currentPrice = newPrice;
        asset.currentValue = asset.quantity * newPrice;
        asset.resultValue = asset.currentValue - asset.totalInvested;
        asset.resultPercent = asset.totalInvested > 0 ? (asset.resultValue / asset.totalInvested) * 100 : 0;
        
        // 2. Atualiza a linha do ativo na tabela (DOM)
        updateAssetRowUI(asset);

        // 3. Recalcula e atualiza os totais da carteira
        recalculatePortfolioTotals();
    }
}

/**
 * Atualiza os elementos da interface do usuário para uma linha de ativo específica.
 * @param {object} asset - O objeto de ativo com os dados atualizados.
 */
function updateAssetRowUI(asset) {
    const marketValueEl = document.getElementById(`market-value-${asset.id}`);
    const resultValueEl = document.getElementById(`result-value-${asset.id}`);
    const resultPercentEl = document.getElementById(`result-percent-${asset.id}`);
    
    if (marketValueEl) marketValueEl.textContent = formatCurrency(asset.currentValue);
    
    if (resultValueEl && resultPercentEl) {
        resultValueEl.textContent = formatCurrency(asset.resultValue);
        resultPercentEl.textContent = `${asset.resultPercent.toFixed(2)}%`;

        const resultClass = asset.resultValue >= 0 ? 'positive' : 'negative';
        const oppositeClass = asset.resultValue >= 0 ? 'negative' : 'positive';
        
        resultValueEl.classList.remove(oppositeClass);
        resultPercentEl.classList.remove(oppositeClass);
        resultValueEl.classList.add(resultClass);
        resultPercentEl.classList.add(resultClass);
    }
}

/**
 * Recalcula e atualiza os totais do portfólio (Patrimônio, Resultado) e o peso de cada ativo.
 */
function recalculatePortfolioTotals() {
    const assets = investmentsUI._currentPortfolioAssets;
    
    // 1. Calcula o novo patrimônio total
    const portfolioTotalValue = assets.reduce((sum, asset) => sum + asset.currentValue, 0);

    // 2. Atualiza o peso (%) de cada ativo na carteira
    assets.forEach(asset => {
        const weight = portfolioTotalValue > 0 ? (asset.currentValue / portfolioTotalValue) * 100 : 0;
        const weightEl = document.getElementById(`weight-${asset.id}`);
        if (weightEl) {
            weightEl.querySelector('span').textContent = `${weight.toFixed(2)}%`;
        }
    });

    // 3. Recalcula o resultado total da carteira
    const portfolioTotalCost = assets.reduce((sum, asset) => sum + asset.totalInvested, 0);
    const portfolioResult = portfolioTotalValue - portfolioTotalCost;
    const portfolioResultPercent = portfolioTotalCost > 0 ? (portfolioResult / portfolioTotalCost) * 100 : 0;

    // 4. Atualiza os cards de resumo da carteira no DOM
    const totalValueEl = document.getElementById('portfolio-total-value');
    const resultValueEl = document.getElementById('portfolio-result-value');
    const resultPercentEl = document.getElementById('portfolio-result-percent');
    const resultContainer = document.getElementById('portfolio-result-container');

    if (totalValueEl) totalValueEl.textContent = formatCurrency(portfolioTotalValue);

    if (resultValueEl && resultPercentEl && resultContainer) {
        resultValueEl.textContent = formatCurrency(portfolioResult);
        resultPercentEl.textContent = portfolioResultPercent.toFixed(2);
        
        const resultClass = portfolioResult >= 0 ? 'positive' : 'negative';
        const oppositeClass = portfolioResult >= 0 ? 'negative' : 'positive';
        resultContainer.classList.remove(oppositeClass);
        resultContainer.classList.add(resultClass);
    }
}
// FIM DA ALTERAÇÃO


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
        ownershipType: form['portfolio-type'].value, // 'own' or 'third-party'
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
 * Handler para o formulário de adicionar novo ativo com sua primeira compra.
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

    const purchaseData = {
        date: form['asset-initial-purchase-date'].value,
        quantity: parseFloat(form['asset-initial-quantity'].value),
        price: parseFloat(form['asset-initial-price'].value),
        accountId: form['asset-initial-account'].value,
        userId: state.currentUser.uid
    };

    try {
        await assets.addAssetWithInitialPurchase(selectedPortfolio.id, assetData, purchaseData);
        showNotification("Ativo registrado com sucesso!");
        form.reset();
        await investmentsUI.loadAndRenderAssets(selectedPortfolio.id);
        await loadUserAccounts(); // Recarrega contas para atualizar saldos
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
    const editButton = e.target.closest('.edit-btn[data-asset-id]');

    if (editButton) {
        e.stopPropagation();
        const assetId = editButton.dataset.assetId;
        investmentsUI.openEditAssetModal(assetId);
    }
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

function handleUpdateMovement(e) {
    e.preventDefault();
    showNotification("Lógica de salvar edição de movimento pendente.", "info");
}

async function handleMovementsListActions(e) {
    const editButton = e.target.closest('.edit-btn[data-movement-id]');
    const deleteButton = e.target.closest('.delete-btn[data-movement-id]');

    if (editButton) {
        const movementId = editButton.dataset.movementId;
        investmentsUI.openEditMovementModal(movementId);
    }

    if (deleteButton) {
        const movementId = deleteButton.dataset.movementId;
        const currentAsset = state.selectedAssetForMovementsView;

        if (!currentAsset || !currentAsset.portfolioId) {
            showNotification("Erro: Não foi possível identificar o ativo ou carteira.", "error");
            return;
        }

        if (confirm("Tem certeza que deseja excluir esta operação? O saldo da sua conta e a posição do ativo serão recalculados. Esta ação é irreversível.")) {
            try {
                await movements.deleteMovementAndRecalculate(currentAsset.portfolioId, currentAsset.id, movementId);
                showNotification("Operação excluída e posição do ativo recalculada com sucesso!");
                // Recarrega a view de movimentos para mostrar os dados atualizados
                await investmentsUI.refreshMovementsView();
            } catch (error) {
                showNotification(error.message, "error");
            }
        }
    }
}

function handleNavigateInvoice(direction) {
    const select = document.getElementById('invoice-period-select');
    if (!select || select.options.length <= 1) return;

    let currentIndex = select.selectedIndex;
    let newIndex;

    if (direction === 'next') {
        newIndex = Math.max(0, currentIndex - 1); // Faturas mais recentes vêm primeiro
    } else { // 'prev'
        newIndex = Math.min(select.options.length - 1, currentIndex + 1);
    }

    if (newIndex !== currentIndex) {
        select.selectedIndex = newIndex;
        select.dispatchEvent(new Event('change'));
    }
}

function handleAddSplitItem(e) {
    e.preventDefault();
    const form = e.target;
    const category = form['split-category'].value;
    const amount = parseFloat(form['split-amount'].value);

    if (!category || isNaN(amount) || amount <= 0) {
        showNotification('Por favor, selecione uma categoria e insira um valor válido.', 'error');
        return;
    }
    
    modals.addSplitItem({ category, amount });
    form.reset();
}

function handleConfirmSplit() {
    isTransactionSplit = true;
    const categorySelect = document.getElementById('transaction-category');
    const subcategoryWrapper = document.getElementById('transaction-subcategory-wrapper');
    const categoryWrapper = document.getElementById('category-control-wrapper');
    
    categorySelect.disabled = true;
    subcategoryWrapper.style.display = 'none';
    categoryWrapper.querySelector('label').textContent = `Dividido em ${modals._currentSplits.length} categorias`;

    modals.closeSplitModal();
}

function resetSplitState() {
    isTransactionSplit = false;
    modals._currentSplits = [];
    const categorySelect = document.getElementById('transaction-category');
    const categoryWrapper = document.getElementById('category-control-wrapper');
    categorySelect.disabled = false;
    categoryWrapper.querySelector('label').textContent = 'Categoria';
}

async function handleConfirmInvoicePayment(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const invoiceId = form['pay-invoice-id'].value;
        const accountId = form['pay-invoice-account-select'].value;
        const paymentDate = form['pay-invoice-date'].value;

        if (!accountId) {
            throw new Error("Por favor, selecione uma conta para o pagamento.");
        }

        const selectedInvoice = state.currentCardInvoices.find(inv => inv.id === invoiceId);
        if (!selectedInvoice || !state.selectedCardForInvoiceView) {
            throw new Error("Fatura ou cartão não encontrado. Tente novamente.");
        }

        const paymentDetails = { accountId, paymentDate };

        await invoices.payInvoice(selectedInvoice, state.selectedCardForInvoiceView, paymentDetails);
        showNotification("Fatura paga com sucesso!");
        
        modals.closePayInvoiceModal();
        await modals.loadAndDisplayInvoices(state.selectedCardForInvoiceView);
        await app.loadUserDashboard();
        await app.loadUserAccounts();

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function handleConfirmAdvancePayment(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const invoiceId = form['advance-payment-invoice-id'].value;
        const accountId = form['advance-payment-account-select'].value;
        const amount = parseFloat(form['advance-payment-amount'].value);
        const date = form['advance-payment-date'].value;

        if (!accountId || !amount || amount <= 0 || !date) {
            throw new Error("Todos os campos são obrigatórios.");
        }
        
        await invoices.makeAdvancePayment(invoiceId, amount, accountId, date);
        showNotification("Pagamento antecipado realizado com sucesso!");

        modals.closeAdvancePaymentModal();
        await modals.loadAndDisplayInvoices(state.selectedCardForInvoiceView);
        await app.loadUserDashboard();
        await app.loadUserAccounts();
        
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function handleAddTransfer(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const transferData = {
        description: form['transfer-description'].value,
        amount: parseFloat(form['transfer-amount'].value),
        date: form['transfer-date'].value,
        fromAccountId: form['transfer-from-account'].value,
        toAccountId: form['transfer-to-account'].value,
        userId: state.currentUser.uid,
    };
    
    try {
        await transfers.addTransfer(transferData);
        showNotification("Transferência realizada com sucesso!");
        form.reset();
        document.getElementById('transfer-date').value = new Date().toISOString().split('T')[0];

        await app.loadUserDashboard();
        await app.loadUserAccounts();

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function handleUpdateTransfer(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const transferId = form['edit-transfer-id'].value;
    const updatedData = {
        description: form['edit-transfer-description'].value,
        amount: parseFloat(form['edit-transfer-amount'].value),
        date: form['edit-transfer-date'].value,
        fromAccountId: form['edit-transfer-from-account'].value,
        toAccountId: form['edit-transfer-to-account'].value,
    };

    try {
        await transfers.updateTransfer(transferId, updatedData);
        showNotification('Transferência atualizada com sucesso!');
        modals.closeEditTransferModal();
        await app.loadUserDashboard();
        await app.loadUserAccounts();
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function handleDeleteTransfer(transfer) {
    if (confirm(`Tem certeza que deseja excluir esta transferência?`)) {
        try {
            await transfers.deleteTransfer(transfer);
            showNotification('Transferência excluída com sucesso!');
            await app.loadUserDashboard();
            await app.loadUserAccounts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

async function handleDescriptionAutocomplete(searchTerm) {
    const datalist = document.getElementById('description-suggestions');
    if (!state.currentUser || !datalist) return;
    const suggestions = await getDescriptionSuggestions(state.currentUser.uid, searchTerm);
    datalist.innerHTML = '';
    suggestions.forEach(suggestionText => {
        const option = document.createElement('option');
        option.value = suggestionText;
        datalist.appendChild(option);
    });
}

async function handleAddTransaction(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const tagsString = form['transaction-tags'].value;
    const tags = tagsString.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag);

    const paymentMethod = form['payment-method'].value;

    const transactionData = {
        description: form['transaction-description'].value,
        amount: parseFloat(form['transaction-amount'].value),
        date: form['transaction-date'].value,
        type: form['transaction-type'].value,
        paymentMethod: paymentMethod,
        userId: state.currentUser.uid,
        isInstallment: false,
        isSplit: isTransactionSplit,
        splits: isTransactionSplit ? modals._currentSplits : null,
        tags: tags.length > 0 ? tags : []
    };

    if (!isTransactionSplit) {
        const categorySelect = form['transaction-category'];
        const selectedCategoryOption = categorySelect.options[categorySelect.selectedIndex];
        transactionData.category = selectedCategoryOption.value;
        transactionData.categoryId = selectedCategoryOption.dataset.categoryId;
        transactionData.subcategory = form['transaction-subcategory'].value.trim();
        if (!transactionData.category) {
            showNotification("Por favor, selecione uma categoria.", 'error');
            submitButton.disabled = false;
            return;
        }
    } else {
        transactionData.category = "Dividido";
    }

    let cardData = null;
    if (transactionData.paymentMethod === 'credit_card') {
        const cardId = form['credit-card-select'].value;
        if (!cardId) {
            showNotification("Por favor, selecione um cartão de crédito.", 'error');
            submitButton.disabled = false;
            return;
        }
        transactionData.cardId = cardId;
        cardData = state.userCreditCards.find(card => card.id === cardId);
        const isInstallment = form['is-installment-checkbox'].checked;
        if (isInstallment) {
            transactionData.isInstallment = true;
            transactionData.installments = parseInt(form['installments-count'].value);
            if (isNaN(transactionData.installments) || transactionData.installments < 2) {
                showNotification("O número de parcelas deve ser 2 ou maior.", 'error');
                submitButton.disabled = false;
                return;
            }
        }
    } else {
        const accountId = form['transaction-account'].value;
        if (!accountId) {
            showNotification("Por favor, selecione uma conta.", 'error');
            submitButton.disabled = false;
            return;
        }
        transactionData.accountId = accountId;
    }
    
    try {
        await transactions.addTransaction(transactionData, cardData);
        showNotification("Transação adicionada com sucesso!");
        form.reset();
        resetSplitState();
        document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('credit-card-wrapper').style.display = 'none';
        document.getElementById('installment-options-wrapper').style.display = 'none';
        document.getElementById('installments-count-wrapper').style.display = 'none';
        document.getElementById('transaction-amount-label').textContent = 'Valor (R$)';
        document.getElementById('transaction-subcategory-wrapper').style.display = 'none';
        
        await app.loadUserDashboard();
        await app.loadUserAccounts();
        
        if (!isTransactionSplit && transactionData.subcategory) {
            app.loadUserCategories();
        }
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function handleDeleteTransaction(transaction) {
    if (confirm(`Tem certeza que deseja excluir a transação "${transaction.description}"?`)) {
        try {
            await transactions.deleteTransaction(transaction);
            showNotification('Transação excluída com sucesso!');
            await app.loadUserDashboard();
            await app.loadUserAccounts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

async function handleUpdateTransaction(e) {
    e.preventDefault();
    const form = e.target;
    const transactionId = form['edit-transaction-id'].value;
    const paymentMethod = form['edit-payment-method'].value;
    
    const tagsString = form['edit-transaction-tags'].value;
    const tags = tagsString.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag);

    const updatedData = {
        description: form['edit-transaction-description'].value,
        amount: parseFloat(form['edit-transaction-amount'].value),
        date: form['edit-transaction-date'].value,
        type: form['edit-transaction-type'].value,
        category: form['edit-transaction-category'].value,
        paymentMethod: paymentMethod,
        tags: tags.length > 0 ? tags : []
    };
    
    if (paymentMethod === 'credit_card') {
        updatedData.cardId = form['edit-credit-card-select'].value;
    } else {
        updatedData.accountId = form['edit-transaction-account'].value;
        if (!updatedData.accountId) {
            showNotification("Por favor, selecione uma conta.", "error");
            return;
        }
    }

    try {
        await transactions.updateTransaction(transactionId, updatedData);
        showNotification('Transação atualizada com sucesso!');
        modals.closeEditModal();
        await app.loadUserDashboard();
        await app.loadUserAccounts();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleAddAccount(e) {
    e.preventDefault();
    const form = e.target;
    const accountData = {
        name: form['account-name'].value,
        initialBalance: parseFloat(form['account-initial-balance'].value),
        type: 'checking',
        userId: state.currentUser.uid
    };
    try {
        await accounts.addAccount(accountData);
        showNotification("Conta adicionada com sucesso!");
        form.reset();
        await app.loadUserAccounts();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleDeleteAccount(accountId) {
    const account = state.userAccounts.find(acc => acc.id === accountId);
    if (!account) return;

    if (account.currentBalance !== 0) {
        if (!confirm(`A conta "${account.name}" possui um saldo de ${formatCurrency(account.currentBalance)}. Excluir uma conta com saldo pode causar inconsistências. Deseja continuar?`)) {
            return;
        }
    } else {
        if (!confirm(`Tem certeza que deseja excluir a conta "${account.name}"? Esta ação não pode ser desfeita.`)) {
            return;
        }
    }

    try {
        await accounts.deleteAccount(accountId);
        showNotification('Conta excluída com sucesso!');
        await app.loadUserAccounts();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}


async function handleUpdateInvoiceTransaction(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        const transactionId = form['edit-invoice-transaction-id'].value;
        const originalInvoiceId = form['edit-invoice-id'].value;
        const cardId = form['edit-invoice-card-id'].value;
        const updatedData = {
            description: form['edit-invoice-tx-description'].value,
            amount: parseFloat(form['edit-invoice-tx-amount'].value),
            purchaseDate: form['edit-invoice-tx-date'].value,
            category: form['edit-invoice-tx-category'].value,
        };
        const card = state.userCreditCards.find(c => c.id === cardId);
        if (!card) throw new Error("Cartão de crédito não encontrado.");
        await invoices.updateInvoiceTransaction(originalInvoiceId, transactionId, updatedData, card);
        showNotification('Lançamento atualizado com sucesso!');
        modals.closeEditInvoiceTransactionModal();
        await modals.loadAndDisplayInvoices(card);
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function handleDeleteInvoiceTransaction(invoiceId, transactionId) {
    if (confirm('Tem certeza que deseja excluir este lançamento?')) {
        try {
            await invoices.deleteInvoiceTransaction(invoiceId, transactionId);
            showNotification('Lançamento excluído com sucesso!');
            if (state.selectedCardForInvoiceView) {
                await modals.loadAndDisplayInvoices(state.selectedCardForInvoiceView);
            }
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

async function handleAddCreditCard(e) {
    e.preventDefault();
    const form = e.target;
    const cardData = {
        name: form['card-name'].value,
        closingDay: parseInt(form['card-closing-day'].value),
        dueDay: parseInt(form['card-due-day'].value),
        limit: parseFloat(form['card-limit'].value),
        userId: state.currentUser.uid
    };
    try {
        await creditCard.addCreditCard(cardData);
        showNotification("Cartão adicionado com sucesso!");
        form.reset();
        app.loadUserCreditCards();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleUpdateCreditCard(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const cardId = form['edit-card-id'].value;
    const updatedData = {
        name: form['edit-card-name'].value,
        closingDay: parseInt(form['edit-card-closing-day'].value),
        dueDay: parseInt(form['edit-card-due-day'].value),
        limit: parseFloat(form['edit-card-limit'].value),
    };

    try {
        await creditCard.updateCreditCard(cardId, updatedData);
        showNotification('Cartão atualizado com sucesso!');
        modals.closeEditCardModal();
        await app.loadUserCreditCards();
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function handleDeleteCreditCard(cardId) {
    const card = state.userCreditCards.find(c => c.id === cardId);
    if (confirm(`Tem certeza de que deseja excluir o cartão "${card.name}"?`)) {
        try {
            await creditCard.deleteCreditCard(cardId);
            showNotification('Cartão excluído com sucesso!');
            app.loadUserCreditCards();
            if (state.selectedCardForInvoiceView && state.selectedCardForInvoiceView.id === cardId) {
                modals.showCardManagementView();
            }
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

async function handleAddCategory(e) {
    e.preventDefault();
    const form = e.target;
    const categoryData = {
        name: form['new-category-name'].value.trim(),
        type: form['new-category-type'].value,
        userId: state.currentUser.uid
    };
    if (!categoryData.name) {
        showNotification("O nome da categoria não pode estar vazio.", "error");
        return;
    }
    try {
        await categories.addCategory(categoryData);
        showNotification("Categoria adicionada com sucesso!");
        form.reset();
        app.loadUserCategories();
    } catch (error) {
        showNotification(error.message, "error");
    }
}

async function handleDeleteCategory(categoryId) {
    const cat = state.userCategories.find(c => c.id === categoryId);
    if (confirm(`Tem certeza de que deseja excluir a categoria "${cat.name}"? Todas as suas subcategorias também serão removidas.`)) {
        try {
            await categories.deleteCategory(categoryId);
            showNotification("Categoria excluída com sucesso!");
            app.loadUserCategories();
        } catch (error) {
            showNotification(error.message, "error");
        }
    }
}

async function handleAddSubcategory(categoryId, subcategoryName, form) {
    if (!subcategoryName.trim()) {
        showNotification("O nome da subcategoria não pode estar vazio.", "error");
        return;
    }
    try {
        await categories.addSubcategory(categoryId, subcategoryName);
        showNotification("Subcategoria adicionada com sucesso!");
        form.reset();
        await app.loadUserCategories();
    } catch (error) {
        showNotification(error.message, "error");
    }
}

async function handleDeleteSubcategory(categoryId, subcategoryName) {
    if (confirm(`Tem certeza de que deseja excluir a subcategoria "${subcategoryName}"?`)) {
        try {
            await categories.deleteSubcategory(categoryId, subcategoryName);
            showNotification("Subcategoria excluída com sucesso!");
            await app.loadUserCategories();
        } catch (error) {
            showNotification(error.message, "error");
        }
    }
}

async function handleSetBudget(e) {
    e.preventDefault();
    const form = e.target;
    const budgetData = {
        category: form['budget-category'].value,
        amount: parseFloat(form['budget-amount'].value),
        userId: state.currentUser.uid
    };
    if (!budgetData.category || isNaN(budgetData.amount) || budgetData.amount <= 0) {
        showNotification("Por favor, selecione uma categoria e insira um valor válido.", "error");
        return;
    }
    try {
        await budget.setBudget(budgetData);
        showNotification(`Orçamento para "${budgetData.category}" salvo!`);
        form.reset();
        app.loadUserBudgets();
    } catch (error) {
        showNotification(error.message, "error");
    }
}

async function handleDeleteBudget(budgetId) {
    const bud = state.userBudgets.find(b => b.id === budgetId);
     if (confirm(`Excluir o orçamento para "${bud.category}"?`)) {
        try {
            await budget.deleteBudget(budgetId);
            showNotification("Orçamento excluído!");
            app.loadUserBudgets();
        } catch (error) {
            showNotification(error.message, "error");
        }
    }
}

async function handleAddRecurring(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const recurringData = {
        description: form['recurring-description'].value,
        amount: parseFloat(form['recurring-amount'].value),
        dayOfMonth: parseInt(form['recurring-day'].value),
        type: form['recurring-type'].value,
        category: form['recurring-category'].value,
        paymentMethod: form['recurring-payment-method'].value,
        userId: state.currentUser.uid
    };

    if (recurringData.paymentMethod === 'credit_card') {
        recurringData.cardId = form['recurring-card'].value;
        recurringData.accountId = null;
    } else { // account_debit
        recurringData.accountId = form['recurring-account'].value;
        recurringData.cardId = null;
    }

    try {
        await recurring.addRecurringTransaction(recurringData);
        showNotification("Recorrência adicionada com sucesso!");
        form.reset();
        document.getElementById('recurring-account-wrapper').style.display = 'block';
        document.getElementById('recurring-card-wrapper').style.display = 'none';

        const recurringTxs = await recurring.getRecurringTransactions(state.currentUser.uid);
        state.setUserRecurringTransactions(recurringTxs);
        render.renderRecurringList();
    } catch (error) {
        showNotification(error.message, "error");
    } finally {
        submitButton.disabled = false;
    }
}

async function handleUpdateRecurring(e) {
    e.preventDefault();
    const form = e.target;
    const recurringId = form['edit-recurring-id'].value;
    const updatedData = {
        description: form['edit-recurring-description'].value,
        amount: parseFloat(form['edit-recurring-amount'].value),
        dayOfMonth: parseInt(form['edit-recurring-day'].value),
        type: form['edit-recurring-type'].value,
        category: form['edit-recurring-category'].value,
        paymentMethod: form['edit-recurring-payment-method'].value,
    };

    if (updatedData.paymentMethod === 'credit_card') {
        updatedData.cardId = form['edit-recurring-card'].value;
        updatedData.accountId = null;
    } else { // account_debit
        updatedData.accountId = form['edit-recurring-account'].value;
        updatedData.cardId = null;
    }

    try {
        await recurring.updateRecurringTransaction(recurringId, updatedData);
        showNotification('Recorrência atualizada com sucesso!');
        modals.closeEditRecurringModal();
        
        const recurringTxs = await recurring.getRecurringTransactions(state.currentUser.uid);
        state.setUserRecurringTransactions(recurringTxs);
        render.renderRecurringList();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleDeleteRecurring(recurringTx) {
    if (confirm(`Tem certeza que deseja excluir a recorrência "${recurringTx.description}"?`)) {
        try {
            await recurring.deleteRecurringTransaction(recurringTx.id);
            showNotification('Recorrência excluída com sucesso!');
            
            const recurringTxs = await recurring.getRecurringTransactions(state.currentUser.uid);
            state.setUserRecurringTransactions(recurringTxs);
            render.renderRecurringList();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

function handleExportCsv() {
    if (state.filteredTransactions.length === 0) {
        showNotification("Nenhuma transação para exportar.", "error");
        return;
    }

    const headers = ['Data', 'Descrição', 'Valor', 'Tipo', 'Categoria', 'Subcategoria', 'Método de Pagamento'];
    const csvRows = state.filteredTransactions.map(t => {
        const row = [
            t.date.toLocaleDateString('pt-BR'),
            `"${t.description.replace(/"/g, '""')}"`,
            t.amount.toFixed(2).replace('.', ','),
            t.type === 'revenue' ? 'Receita' : 'Despesa',
            t.category,
            t.subcategory || '',
            t.paymentMethod
        ];
        return row.join(';');
    });

    const csvContent = [headers.join(';'), ...csvRows].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `transacoes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
