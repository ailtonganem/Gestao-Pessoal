// js/modules/investments/ui.js

/**
 * Módulo para gerenciar a interface do usuário (UI) do modal de investimentos.
 * Controla a abertura, fechamento, troca de visualizações e renderização de dados.
 */

import * as state from '../state.js';
import * as portfolios from './portfolios.js';
import * as assets from './assets.js';
import * as movements from './movements.js';
import { showNotification } from '../ui/notifications.js';
import { formatCurrency, formatDateToInput } from '../ui/utils.js';
import { populateAccountSelects } from '../ui/render.js';
import * as charts from '../ui/charts.js';
import { getQuotes } from '../../services/brapi.js';

// --- Variáveis de Estado do Módulo ---
let _currentPortfolioAssets = [];
// INÍCIO DA ALTERAÇÃO
let _currentAssetMovements = [];
// FIM DA ALTERAÇÃO

// --- Seleção de Elementos do DOM ---
const investmentDashboardView = document.getElementById('investment-dashboard-view');
const portfoliosManagementView = document.getElementById('portfolios-management-view');
const portfolioFilterSelect = document.getElementById('portfolio-filter-select');

// Cards do Dashboard
const rentabilidadeCard = document.getElementById('rentabilidade-card');
const composicaoCard = document.getElementById('composicao-card');
const calendarioCard = document.getElementById('calendario-card');
const patrimonioCard = document.getElementById('patrimonio-card');
const proventosCard = document.getElementById('proventos-card');
const altasBaixasCard = document.getElementById('altas-baixas-card');
const investmentHistoryCard = document.getElementById('investment-history-card');

const portfoliosView = document.getElementById('portfolios-view');
const assetsView = document.getElementById('assets-view');
const portfoliosListEl = document.getElementById('portfolios-list');
const assetsPortfolioNameEl = document.getElementById('assets-portfolio-name');
const assetListEl = document.getElementById('asset-list');

const movementModal = document.getElementById('asset-movement-modal');
const movementModalTitle = document.getElementById('asset-movement-modal-title');
const movementAssetIdInput = document.getElementById('movement-asset-id');
const movementDateInput = document.getElementById('movement-date');
const movementAccountSelect = document.getElementById('movement-account');

const proventoModal = document.getElementById('provento-modal');
const proventoModalTitle = document.getElementById('provento-modal-title');
const proventoAssetIdInput = document.getElementById('provento-asset-id');
const proventoPaymentDateInput = document.getElementById('provento-payment-date');
const proventoAccountSelect = document.getElementById('provento-account');

// INÍCIO DA ALTERAÇÃO
const movementsView = document.getElementById('movements-view');
const movementsAssetNameEl = document.getElementById('movements-asset-name');
const movementsListEl = document.getElementById('movements-list');

// Modais de Edição
const editPortfolioModal = document.getElementById('edit-portfolio-modal');
const editAssetModal = document.getElementById('edit-asset-modal');
const editMovementModal = document.getElementById('edit-movement-modal');
// FIM DA ALTERAÇÃO


// --- Funções de Gerenciamento de Views ---

/**
 * Exibe a visualização principal do dashboard de investimentos.
 */
export function showInvestmentDashboardView() {
    investmentDashboardView.style.display = 'block';
    portfoliosManagementView.style.display = 'none';
}

/**
 * Exibe a visualização de gerenciamento de carteiras e ativos.
 */
export function showPortfoliosManagementView() {
    investmentDashboardView.style.display = 'none';
    portfoliosManagementView.style.display = 'block';
    showPortfoliosView(); // Mostra a lista de carteiras por padrão
}


/**
 * Exibe a visualização de gerenciamento de carteiras (dentro da tela de gerenciamento).
 */
export function showPortfoliosView() {
    portfoliosView.style.display = 'block';
    assetsView.style.display = 'none';
    // INÍCIO DA ALTERAÇÃO
    movementsView.style.display = 'none';
    // FIM DA ALTERAÇÃO
    state.setSelectedPortfolioForAssetsView(null); // Limpa a seleção ao voltar
}

/**
 * Exibe a visualização de gerenciamento de ativos para uma carteira específica.
 * @param {object} portfolio - O objeto da carteira selecionada.
 */
export async function showAssetsView(portfolio) {
    state.setSelectedPortfolioForAssetsView(portfolio); 
    assetsPortfolioNameEl.textContent = `Ativos - ${portfolio.name}`;
    portfoliosView.style.display = 'none';
    assetsView.style.display = 'block';
    // INÍCIO DA ALTERAÇÃO
    movementsView.style.display = 'none';
    // FIM DA ALTERAÇÃO
    await loadAndRenderAssets(portfolio.id); 
}

// INÍCIO DA ALTERAÇÃO
/**
 * Exibe a visualização de detalhes e movimentos de um ativo específico.
 * @param {string} assetId - O ID do ativo selecionado.
 */
export async function showMovementsView(assetId) {
    const asset = _currentPortfolioAssets.find(a => a.id === assetId);
    if (!asset) {
        showNotification("Ativo não encontrado.", "error");
        return;
    }
    
    movementsAssetNameEl.textContent = `Movimentos - ${asset.ticker}`;
    assetsView.style.display = 'none';
    movementsView.style.display = 'block';

    await loadAndRenderMovements(asset);
}
// FIM DA ALTERAÇÃO

// --- Novas Funções de Orquestração do Dashboard ---

/**
 * Ponto de entrada principal para a página de investimentos.
 * Carrega os dados iniciais e renderiza o dashboard.
 */
export async function loadInvestmentDashboard() {
    showInvestmentDashboardView();
    try {
        const userPortfolios = await portfolios.getPortfolios(state.currentUser.uid);
        state.setUserPortfolios(userPortfolios);
        renderPortfolioFilter(userPortfolios);
        await updateInvestmentDashboard('all'); // Carrega a visão consolidada por padrão
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/**
 * Atualiza todos os componentes do dashboard com base na carteira selecionada.
 * @param {string} portfolioId - O ID da carteira a ser exibida, ou 'all' para consolidado.
 */
export async function updateInvestmentDashboard(portfolioId) {
    renderLoadingPlaceholders();

    try {
        let assetsToDisplay = [];
        if (portfolioId === 'all') {
            assetsToDisplay = await portfolios.getAllUserAssets(state.currentUser.uid);
        } else {
            assetsToDisplay = await assets.getAssets(portfolioId);
            assetsToDisplay.forEach(asset => asset.portfolioId = portfolioId);
        }

        const tickers = assetsToDisplay.map(asset => asset.ticker);
        const quotes = await getQuotes(tickers);

        assetsToDisplay.forEach(asset => {
            if (quotes[asset.ticker]) {
                asset.currentValue = quotes[asset.ticker] * asset.quantity;
            } else {
                asset.currentValue = asset.totalInvested;
            }
        });
        
        const movementPromises = assetsToDisplay.map(async (asset) => {
            const assetMovements = await movements.getMovements(asset.portfolioId, asset.id);
            return assetMovements.map(m => ({ ...m, ticker: asset.ticker }));
        });
        
        const allMovementsNested = await Promise.all(movementPromises);
        const allMovementsFlat = allMovementsNested.flat();
        allMovementsFlat.sort((a, b) => b.date - a.date);

        const totalPatrimonio = assetsToDisplay.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);
        
        const composicaoData = assetsToDisplay.reduce((acc, asset) => {
            const key = asset.type || 'Outro';
            if (!acc[key]) {
                acc[key] = 0;
            }
            acc[key] += asset.currentValue || 0;
            return acc;
        }, {});

        const aggregatedData = {
            totalPatrimonio,
            composicao: {
                labels: Object.keys(composicaoData),
                values: Object.values(composicaoData)
            },
            history: allMovementsFlat,
        };

        renderPatrimonioCard(aggregatedData);
        renderComposicaoCard(aggregatedData);
        renderInvestmentHistory(aggregatedData);
        
        renderRentabilidadeCard({});
        renderCalendarioCard({});
        renderProventosCard({});
        renderAltasBaixasCard({});

    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/**
 * Popula o select de filtro de carteiras.
 * @param {Array<object>} userPortfolios - A lista de carteiras do usuário.
 */
function renderPortfolioFilter(userPortfolios) {
    portfolioFilterSelect.innerHTML = '<option value="all">Consolidado</option>';
    userPortfolios.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        portfolioFilterSelect.appendChild(option);
    });
}

/**
 * Renderiza placeholders de "Carregando..." em todos os cards do dashboard.
 */
function renderLoadingPlaceholders() {
    rentabilidadeCard.querySelector('.chart-container').innerHTML = `<p>Carregando dados de rentabilidade...</p>`;
    composicaoCard.querySelector('.chart-container').innerHTML = `<p>Carregando composição...</p>`;
    calendarioCard.querySelector('#proventos-calendar').innerHTML = `<p>Carregando calendário...</p>`;
    patrimonioCard.querySelector('.chart-container').innerHTML = `<p>Carregando patrimônio...</p>`;
    document.getElementById('patrimonio-total-valor').textContent = '...';
    proventosCard.querySelector('#proventos-summary').innerHTML = `<p>Carregando proventos...</p>`;
    altasBaixasCard.querySelector('#altas-baixas-list').innerHTML = `<p>Carregando...</p>`;
    investmentHistoryCard.querySelector('#investment-history-list').innerHTML = `<li>Carregando histórico...</li>`;
}

// --- Funções de Renderização dos Cards ---

function renderRentabilidadeCard(data) {
    const canvas = document.createElement('canvas');
    canvas.id = 'rentabilidade-chart';
    rentabilidadeCard.querySelector('.chart-container').innerHTML = '';
    rentabilidadeCard.querySelector('.chart-container').appendChild(canvas);
    charts.renderRentabilidadeChart(data.rentabilidade || {});
}

function renderComposicaoCard(data) {
    const canvas = document.createElement('canvas');
    canvas.id = 'composicao-chart';
    composicaoCard.querySelector('.chart-container').innerHTML = '';
    composicaoCard.querySelector('.chart-container').appendChild(canvas);
    charts.renderComposicaoChart(data.composicao || { labels: [], values: [] });
}

function renderCalendarioCard(data) {
    calendarioCard.querySelector('#proventos-calendar').innerHTML = `<p>Funcionalidade de Calendário a ser implementada.</p>`;
}

function renderPatrimonioCard(data) {
    const canvas = document.createElement('canvas');
    canvas.id = 'patrimonio-chart';
    patrimonioCard.querySelector('.chart-container').innerHTML = '';
    patrimonioCard.querySelector('.chart-container').appendChild(canvas);
    charts.renderPatrimonioChart(data.patrimonioEvolucao || {});
    document.getElementById('patrimonio-total-valor').textContent = formatCurrency(data.totalPatrimonio || 0);
}

function renderProventosCard(data) {
    proventosCard.querySelector('#proventos-summary').innerHTML = `<p>Funcionalidade de Proventos a ser implementada.</p>`;
}

function renderAltasBaixasCard(data) {
    altasBaixasCard.querySelector('#altas-baixas-list').innerHTML = `<p>Funcionalidade de Altas/Baixas a ser implementada.</p>`;
}

function renderInvestmentHistory(data) {
    const historyListEl = investmentHistoryCard.querySelector('#investment-history-list');
    historyListEl.innerHTML = '';
    const history = data.history || [];

    if (history.length === 0) {
        historyListEl.innerHTML = `<li>Nenhuma operação registrada no período.</li>`;
        return;
    }

    history.forEach(mov => {
        const li = document.createElement('li');
        li.style.cssText = 'display: flex; justify-content: space-between; padding: 0.8rem 0.5rem; border-bottom: 1px solid var(--background-color); flex-wrap: wrap; gap: 0.5rem;';
        
        let typeLabel = '';
        let typeClass = '';
        let details = '';

        switch(mov.type) {
            case 'buy':
                typeLabel = 'Compra';
                typeClass = 'buy';
                details = `<span>${mov.quantity} un.</span><span>@ ${formatCurrency(mov.pricePerUnit)}</span> <span style="font-weight: bold; font-family: monospace;">${formatCurrency(mov.totalCost)}</span>`;
                break;
            case 'sell':
                typeLabel = 'Venda';
                typeClass = 'sell';
                details = `<span>${mov.quantity} un.</span><span>@ ${formatCurrency(mov.pricePerUnit)}</span> <span style="font-weight: bold; font-family: monospace;">${formatCurrency(mov.totalCost)}</span>`;
                break;
            case 'provento':
                typeLabel = mov.proventoType || 'Provento';
                typeClass = 'provento';
                details = `<span style="font-weight: bold; font-family: monospace;">${formatCurrency(mov.totalAmount)}</span>`;
                break;
        }
        
        li.innerHTML = `
            <span style="font-weight: 500; color: var(--text-color);">${mov.date.toLocaleDateString('pt-BR')}</span>
            <span style="font-weight: bold;">${mov.ticker}</span>
            <span class="status-badge ${typeClass}">${typeLabel}</span>
            ${details}
        `;
        historyListEl.appendChild(li);
    });
}


// --- Funções de Gerenciamento CRUD ---

export async function loadAndRenderPortfolios() {
    portfoliosListEl.innerHTML = '<li>Carregando carteiras...</li>';
    try {
        const userPortfolios = await portfolios.getPortfolios(state.currentUser.uid);
        state.setUserPortfolios(userPortfolios);
        renderPortfolios(userPortfolios);
    } catch (error) {
        showNotification(error.message, 'error');
        portfoliosListEl.innerHTML = '<li>Erro ao carregar carteiras.</li>';
    }
}

function renderPortfolios(portfoliosToRender) {
    portfoliosListEl.innerHTML = '';

    if (portfoliosToRender.length === 0) {
        portfoliosListEl.innerHTML = '<li>Nenhuma carteira criada. Crie uma abaixo.</li>';
        return;
    }

    portfoliosToRender.forEach(portfolio => {
        const li = document.createElement('li');
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
        portfoliosListEl.appendChild(li);
    });
}

export async function loadAndRenderAssets(portfolioId) {
    assetListEl.innerHTML = '<li>Carregando ativos...</li>';
    try {
        const userAssets = await assets.getAssets(portfolioId);

        const tickers = userAssets.map(asset => asset.ticker);
        const quotes = await getQuotes(tickers);

        userAssets.forEach(asset => {
            if (quotes[asset.ticker]) {
                asset.currentValue = quotes[asset.ticker] * asset.quantity;
            } else {
                asset.currentValue = asset.totalInvested;
            }
        });

        _currentPortfolioAssets = userAssets; 
        renderAssets(userAssets);
    } catch (error) {
        showNotification(error.message, 'error');
        assetListEl.innerHTML = '<li>Erro ao carregar ativos.</li>';
    }
}

function renderAssets(assetsToRender) {
    assetListEl.innerHTML = '';
    if (assetsToRender.length === 0) {
        assetListEl.innerHTML = '<li>Nenhum ativo cadastrado. Adicione um no formulário abaixo.</li>';
        return;
    }

    assetsToRender.forEach(asset => {
        const li = document.createElement('li');
        li.className = 'asset-item';
        
        li.innerHTML = `
            <div class="asset-info" data-asset-id="${asset.id}">
                <span class="asset-ticker">${asset.ticker}</span>
                <span class="asset-name">${asset.name}</span>
                <small class="asset-type">${asset.type} - ${asset.broker || 'N/A'}</small>
            </div>
            <div class="asset-summary">
                <span class="asset-value">${formatCurrency(asset.currentValue)}</span>
                <small class="asset-quantity">${asset.quantity} Cotas</small>
            </div>
            <div class="asset-actions">
                <button class="action-btn add-provento-btn" data-asset-id="${asset.id}" title="Registrar Provento">💲</button>
                <button class="action-btn add-movement-btn" data-asset-id="${asset.id}" title="Adicionar Movimento (Compra/Venda)">➕</button>
                <button class="action-btn edit-btn" data-asset-id="${asset.id}" title="Editar Ativo">&#9998;</button>
                <button class="action-btn delete-btn" data-asset-id="${asset.id}" title="Excluir Ativo">&times;</button>
            </div>
        `;
        assetListEl.appendChild(li);
    });
}

// INÍCIO DA ALTERAÇÃO
async function loadAndRenderMovements(asset) {
    // Renderiza o resumo do ativo
    const summaryEl = document.getElementById('asset-details-summary');
    summaryEl.innerHTML = `
        <div class="detail-item"><h4>Posição Atual</h4><p>${asset.quantity}</p></div>
        <div class="detail-item"><h4>Preço Médio</h4><p>${formatCurrency(asset.averagePrice)}</p></div>
        <div class="detail-item"><h4>Custo Total</h4><p>${formatCurrency(asset.totalInvested)}</p></div>
        <div class="detail-item"><h4>Valor de Mercado</h4><p>${formatCurrency(asset.currentValue)}</p></div>
    `;

    movementsListEl.innerHTML = '<li>Carregando movimentos...</li>';
    try {
        const movementsData = await movements.getMovements(asset.portfolioId, asset.id);
        _currentAssetMovements = movementsData;
        renderMovements(movementsData);
    } catch(error) {
        showNotification(error.message, 'error');
        movementsListEl.innerHTML = '<li>Erro ao carregar movimentos.</li>';
    }
}

function renderMovements(movementsToRender) {
    movementsListEl.innerHTML = '';
    if (movementsToRender.length === 0) {
        movementsListEl.innerHTML = '<li>Nenhuma operação registrada para este ativo.</li>';
        return;
    }
    movementsToRender.forEach(mov => {
        const li = document.createElement('li');
        li.className = 'movement-item';

        // Lógica de exibição similar ao histórico consolidado
        let typeLabel = '';
        let typeClass = '';
        let details = '';

        switch(mov.type) {
            case 'buy':
            case 'sell':
                typeLabel = mov.type === 'buy' ? 'Compra' : 'Venda';
                typeClass = mov.type;
                details = `<span>${mov.quantity} un. @ ${formatCurrency(mov.pricePerUnit)}</span> <span style="font-family: monospace;">${formatCurrency(mov.totalCost)}</span>`;
                break;
            case 'provento':
                typeLabel = mov.proventoType;
                typeClass = 'provento';
                details = `<span style="font-family: monospace;">${formatCurrency(mov.totalAmount)}</span>`;
                break;
        }

        li.innerHTML = `
            <div style="flex-grow: 1;">
                <span style="font-weight: 500;">${mov.date.toLocaleDateString('pt-BR')}</span>
                <span class="status-badge ${typeClass}" style="margin-left: 1rem;">${typeLabel}</span>
            </div>
            <div style="flex-grow: 1; text-align: right;">${details}</div>
            <div class="transaction-actions">
                <button class="action-btn edit-btn" data-movement-id="${mov.id}" title="Editar">&#9998;</button>
                <button class="action-btn delete-btn" data-movement-id="${mov.id}" title="Excluir">&times;</button>
            </div>
        `;
        movementsListEl.appendChild(li);
    });
}
// FIM DA ALTERAÇÃO


export function openMovementModal(assetId) {
    const asset = _currentPortfolioAssets.find(a => a.id === assetId);
    if (!asset) {
        showNotification("Ativo não encontrado.", "error");
        return;
    }

    movementModalTitle.textContent = `Registrar Operação para ${asset.ticker}`;
    movementAssetIdInput.value = assetId;
    movementDateInput.value = formatDateToInput(new Date());

    populateAccountSelects(movementAccountSelect);
    
    movementModal.style.display = 'flex';
}

export function closeMovementModal() {
    document.getElementById('add-movement-form').reset();
    movementModal.style.display = 'none';
}

export function openProventoModal(assetId) {
    const asset = _currentPortfolioAssets.find(a => a.id === assetId);
    if (!asset) {
        showNotification("Ativo não encontrado.", "error");
        return;
    }

    proventoModalTitle.textContent = `Registrar Provento para ${asset.ticker}`;
    proventoAssetIdInput.value = assetId;
    proventoPaymentDateInput.value = formatDateToInput(new Date());

    populateAccountSelects(proventoAccountSelect);
    
    proventoModal.style.display = 'flex';
}

export function closeProventoModal() {
    document.getElementById('add-provento-form').reset();
    proventoModal.style.display = 'none';
}

// INÍCIO DA ALTERAÇÃO
// --- Funções para Modais de Edição ---

export function openEditPortfolioModal(portfolioId) {
    const portfolio = state.userPortfolios.find(p => p.id === portfolioId);
    if (!portfolio) {
        showNotification("Carteira não encontrada.", "error");
        return;
    }
    const form = document.getElementById('edit-portfolio-form');
    form['edit-portfolio-id'].value = portfolio.id;
    form['edit-portfolio-name'].value = portfolio.name;
    form['edit-portfolio-description'].value = portfolio.description;

    editPortfolioModal.style.display = 'flex';
}

export function closeEditPortfolioModal() {
    document.getElementById('edit-portfolio-form').reset();
    editPortfolioModal.style.display = 'none';
}

export function openEditAssetModal(assetId) {
    // Lógica para abrir e preencher o modal de edição de ativo
    showNotification("Funcionalidade de editar ativo pendente.", "info");
}

export function closeEditAssetModal() {
    document.getElementById('edit-asset-form').reset();
    editAssetModal.style.display = 'none';
}

export function openEditMovementModal(movementId) {
    // Lógica para abrir e preencher o modal de edição de movimento
    showNotification("Funcionalidade de editar movimento pendente.", "info");
}

export function closeEditMovementModal() {
    document.getElementById('edit-movement-form').reset();
    editMovementModal.style.display = 'none';
}
// FIM DA ALTERAÇÃO
