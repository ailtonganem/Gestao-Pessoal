// js/modules/investments/ui.js

/**
 * Módulo para gerenciar a interface do usuário (UI) do modal de investimentos.
 * Controla a abertura, fechamento, troca de visualizações e renderização de dados.
 */

import * as state from '../state.js';
import * as portfolios from './portfolios.js';
import * as assets from './assets.js';
import * as movements from './movements.js';
import * as quotes from './quotes.js'; 
import { showNotification } from '../ui/notifications.js';
import { formatCurrency, formatDateToInput } from '../ui/utils.js';
import { populateAccountSelects } from '../ui/render.js';
import * as charts from '../ui/charts.js';
import { getQuotes } from '../../services/brapi.js';

// --- Variáveis de Estado do Módulo ---
export let _currentPortfolioAssets = []; 
let _currentAssetMovements = [];

// --- Seleção de Elementos do DOM ---
const investmentDashboardView = document.getElementById('investment-dashboard-view');
const portfoliosManagementView = document.getElementById('portfolios-management-view');
const portfolioFilterSelect = document.getElementById('portfolio-filter-select');
const investmentDashboardHeader = document.querySelector('.investment-dashboard-header .header-controls');

// Cards do Dashboard
const rentabilidadeCard = document.getElementById('rentabilidade-card');
const composicaoCard = document.getElementById('composicao-card');
const calendarioCard = document.getElementById('calendario-card');
const patrimonioCard = document.getElementById('patrimonio-card');
const proventosMesCard = document.getElementById('proventos-mes-card');
const resultadoMesCard = document.getElementById('resultado-mes-card');
const investmentHistoryCard = document.getElementById('investment-history-card');
const proventosMesTotalEl = document.getElementById('proventos-mes-total');
const resultadoMesTotalEl = document.getElementById('resultado-mes-total');

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
const movementAccountWrapper = document.getElementById('movement-account-wrapper');

const proventoModal = document.getElementById('provento-modal');
const proventoModalTitle = document.getElementById('provento-modal-title');
const proventoAssetIdInput = document.getElementById('provento-asset-id');
const proventoPaymentDateInput = document.getElementById('provento-payment-date');
const proventoAccountSelect = document.getElementById('provento-account');
const proventoAccountWrapper = document.getElementById('provento-account-wrapper');

const assetDetailView = document.getElementById('asset-detail-view');

// Modais de Edição
const editPortfolioModal = document.getElementById('edit-portfolio-modal');
const editAssetModal = document.getElementById('edit-asset-modal');
const editMovementModal = document.getElementById('edit-movement-modal');
const updateQuotesModal = document.getElementById('update-quotes-modal');


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
export async function showPortfoliosManagementView() {
    investmentDashboardView.style.display = 'none';
    portfoliosManagementView.style.display = 'block';
    showPortfoliosView();
    await loadAndRenderPortfolios(); 
}


/**
 * Exibe a visualização de gerenciamento de carteiras (dentro da tela de gerenciamento).
 */
export function showPortfoliosView() {
    portfoliosView.style.display = 'block';
    assetsView.style.display = 'none';
    assetDetailView.style.display = 'none';
    state.setSelectedPortfolioForAssetsView(null); 
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
    assetDetailView.style.display = 'none';

    const assetInitialAccountWrapper = document.getElementById('asset-initial-account-wrapper');
    const assetInitialAccountSelect = document.getElementById('asset-initial-account');

    if (portfolio.ownershipType === 'third-party') {
        assetInitialAccountWrapper.style.display = 'none';
        assetInitialAccountSelect.required = false;
    } else {
        assetInitialAccountWrapper.style.display = 'block';
        assetInitialAccountSelect.required = true;
    }

    await loadAndRenderAssets(portfolio.id); 
}

/**
 * Recarrega e renderiza a view de movimentos para o ativo atualmente selecionado.
 */
export async function refreshMovementsView() {
    const currentAsset = state.selectedAssetForMovementsView;
    if (!currentAsset) return;
    
    await loadAndRenderAssets(currentAsset.portfolioId);
    const updatedAsset = _currentPortfolioAssets.find(a => a.id === currentAsset.id);

    if (updatedAsset) {
        state.setSelectedAssetForMovementsView(updatedAsset);
        await showAssetDetailView(updatedAsset.id);
    } else {
        showAssetsView(state.selectedPortfolioForAssetsView);
    }
}

/**
 * Exibe a nova página de detalhes completa para um ativo específico.
 * @param {string} assetId - O ID do ativo a ser exibido.
 */
export async function showAssetDetailView(assetId) {
    const asset = _currentPortfolioAssets.find(a => a.id === assetId);
    const portfolio = state.selectedPortfolioForAssetsView;

    if (!asset || !portfolio) {
        showNotification("Não foi possível encontrar o ativo ou a carteira.", "error");
        showAssetsView(portfolio);
        return;
    }

    state.setSelectedAssetForMovementsView(asset);

    // Esconde as outras views
    portfoliosView.style.display = 'none';
    assetsView.style.display = 'none';
    assetDetailView.style.display = 'block';

    // Preenche placeholders de "carregando"
    renderAssetDetailPlaceholders(asset.ticker, asset.name);

    try {
        const [assetMovements, savedQuotes] = await Promise.all([
            movements.getMovements(portfolio.id, asset.id),
            quotes.getSavedQuotes(state.currentUser.uid)
        ]);
        
        _currentAssetMovements = assetMovements;
        const currentQuote = savedQuotes[asset.ticker]?.currentPrice || asset.averagePrice;
        
        renderAssetDetailSummaryCards(asset, assetMovements, currentQuote);
        renderAssetStaticInfo(asset);
        renderAssetDetailOperations(assetMovements.filter(m => m.type === 'buy' || m.type === 'sell'));
        renderAssetDetailProventos(assetMovements.filter(m => m.type === 'provento'), asset.averagePrice);

    } catch (error) {
        showNotification(error.message, "error");
    }
}

// --- Novas Funções de Orquestração do Dashboard ---

/**
 * Ponto de entrada principal para a página de investimentos.
 * Carrega os dados iniciais e renderiza o dashboard.
 */
export async function loadInvestmentDashboard() {
    showInvestmentDashboardView();
    try {
        if (!document.getElementById('refresh-quotes-button')) {
            addRefreshButtonToDashboardHeader();
        }
        const userPortfolios = await portfolios.getPortfolios(state.currentUser.uid);
        state.setUserPortfolios(userPortfolios);
        renderPortfolioFilter(userPortfolios);
        await updateInvestmentDashboard('all');
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
        
        // --- INÍCIO DA ALTERAÇÃO ---
        const savedQuotes = await quotes.getSavedQuotes(state.currentUser.uid);

        assetsToDisplay.forEach(asset => {
            const currentPrice = savedQuotes[asset.ticker]?.currentPrice || (asset.quantity > 0 ? asset.averagePrice : 0);
            asset.currentValue = currentPrice * asset.quantity;
            asset.currentPrice = currentPrice;
        });
        // --- FIM DA ALTERAÇÃO ---
        
        const movementPromises = assetsToDisplay.map(async (asset) => {
            const assetMovements = await movements.getMovements(asset.portfolioId, asset.id);
            return assetMovements.map(m => ({ ...m, ticker: asset.ticker, averagePriceOnSell: asset.averagePrice }));
        });
        
        const allMovementsNested = await Promise.all(movementPromises);
        const allMovementsFlat = allMovementsNested.flat();
        allMovementsFlat.sort((a, b) => b.date - a.date);

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const totalPatrimonio = assetsToDisplay.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);
        
        // --- INÍCIO DA ALTERAÇÃO ---
        const composicaoData = assetsToDisplay.reduce((acc, asset) => {
            const key = asset.type || 'Outro';
            if (!acc[key]) acc[key] = 0;
            acc[key] += asset.currentValue || 0;
            return acc;
        }, {});
        // --- FIM DA ALTERAÇÃO ---

        const proventosMes = allMovementsFlat
            .filter(m => m.type === 'provento' && m.date.getMonth() === currentMonth && m.date.getFullYear() === currentYear)
            .reduce((sum, m) => sum + m.totalAmount, 0);

        const resultadoMes = allMovementsFlat
            .filter(m => m.type === 'sell' && m.date.getMonth() === currentMonth && m.date.getFullYear() === currentYear)
            .reduce((sum, m) => sum + (m.totalCost - (m.quantity * m.averagePriceOnSell)), 0);

        const aggregatedData = {
            totalPatrimonio,
            composicao: { labels: Object.keys(composicaoData), values: Object.values(composicaoData) },
            history: allMovementsFlat,
            proventosMes,
            resultadoMes
        };

        renderPatrimonioCard(aggregatedData);
        renderComposicaoCard(aggregatedData);
        renderInvestmentHistory(aggregatedData);
        renderProventosMesCard(aggregatedData);
        renderResultadoMesCard(aggregatedData);
        
        renderRentabilidadeCard({});
        renderCalendarioCard({});

    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/** Adiciona o botão de atualização manual de cotações ao cabeçalho. */
function addRefreshButtonToDashboardHeader() {
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-quotes-button';
    refreshButton.className = 'button-secondary';
    refreshButton.textContent = 'Atualizar Cotações';
    refreshButton.title = 'Buscar cotações mais recentes';
    refreshButton.style.display = 'none'; // Desativado por padrão

    refreshButton.addEventListener('click', async () => {
        refreshButton.disabled = true;
        refreshButton.textContent = 'Atualizando...';
        showNotification('Buscando novas cotações...', 'info');

        try {
            const portfolioId = portfolioFilterSelect.value;
            await updateInvestmentDashboard(portfolioId);
            showNotification('Cotações atualizadas com sucesso!');
        } catch (error) {
            showNotification('Erro ao buscar cotações. Tente novamente mais tarde.', 'error');
        } finally {
            refreshButton.disabled = false;
            refreshButton.textContent = 'Atualizar Cotações';
        }
    });

    const manageButton = document.getElementById('go-to-portfolios-management-btn');
    if (manageButton && investmentDashboardHeader) {
        investmentDashboardHeader.insertBefore(refreshButton, manageButton);
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
    if (proventosMesTotalEl) proventosMesTotalEl.textContent = 'Carregando...';
    if (resultadoMesTotalEl) resultadoMesTotalEl.textContent = 'Carregando...';
    investmentHistoryCard.querySelector('#investment-history-list').innerHTML = `<li>Carregando histórico...</li>`;
}

// --- Funções de Renderização dos Cards ---

function renderRentabilidadeCard(data) {
    const container = rentabilidadeCard.querySelector('.chart-container');
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'rentabilidade-chart';
    container.appendChild(canvas);
    charts.renderRentabilidadeChart(data.rentabilidade || {});
}

function renderComposicaoCard(data) {
    const container = composicaoCard.querySelector('.chart-container');
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'composicao-chart';
    container.appendChild(canvas);
    charts.renderComposicaoChart(data.composicao || { labels: [], values: [] });
}

function renderCalendarioCard(data) {
    calendarioCard.querySelector('#proventos-calendar').innerHTML = `<p>Funcionalidade de Calendário a ser implementada.</p>`;
}

function renderPatrimonioCard(data) {
    const container = patrimonioCard.querySelector('.chart-container');
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'patrimonio-chart';
    container.appendChild(canvas);
    charts.renderPatrimonioChart(data.patrimonioEvolucao || {});
    document.getElementById('patrimonio-total-valor').textContent = formatCurrency(data.totalPatrimonio || 0);
}

function renderProventosMesCard(data) {
    if (proventosMesTotalEl) {
        proventosMesTotalEl.textContent = formatCurrency(data.proventosMes || 0);
    }
}

function renderResultadoMesCard(data) {
    if (resultadoMesTotalEl) {
        const value = data.resultadoMes || 0;
        resultadoMesTotalEl.textContent = formatCurrency(value);
        resultadoMesTotalEl.style.color = value >= 0 ? 'var(--success-color)' : 'var(--error-color)';
    }
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
                details = `<span>${mov.quantity} un. @ ${formatCurrency(mov.pricePerUnit)}</span> <span style="font-weight: bold; font-family: monospace;">${formatCurrency(mov.totalCost)}</span>`;
                break;
            case 'sell':
                typeLabel = 'Venda';
                typeClass = 'sell';
                details = `<span>${mov.quantity} un. @ ${formatCurrency(mov.pricePerUnit)}</span> <span style="font-weight: bold; font-family: monospace;">${formatCurrency(mov.totalCost)}</span>`;
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
        const [userAssets, savedQuotes] = await Promise.all([
            assets.getAssets(portfolioId),
            quotes.getSavedQuotes(state.currentUser.uid)
        ]);

        let portfolioTotalValue = 0;
        let portfolioTotalCost = 0;

        userAssets.forEach(asset => {
            const savedQuote = savedQuotes[asset.ticker];
            const currentPrice = savedQuote ? savedQuote.currentPrice : (asset.quantity > 0 ? asset.averagePrice : 0);
            
            asset.currentPrice = currentPrice;
            asset.currentValue = asset.currentPrice * asset.quantity;
            asset.resultValue = asset.currentValue - asset.totalInvested;
            asset.resultPercent = asset.totalInvested > 0 ? (asset.resultValue / asset.totalInvested) * 100 : 0;
            
            portfolioTotalValue += asset.currentValue;
            portfolioTotalCost += asset.totalInvested;
        });

        _currentPortfolioAssets = userAssets; 
        renderAssets(userAssets, portfolioTotalValue, portfolioTotalCost);
    } catch (error) {
        showNotification(error.message, 'error');
        assetListEl.innerHTML = '<li>Erro ao carregar ativos.</li>';
    }
}

function renderAssets(assetsToRender, portfolioTotalValue, portfolioTotalCost) {
    const summarySection = document.getElementById('portfolio-summary-section');
    const portfolioResult = portfolioTotalValue - portfolioTotalCost;
    const portfolioResultPercent = portfolioTotalCost > 0 ? (portfolioResult / portfolioTotalCost) * 100 : 0;
    const resultClass = portfolioResult >= 0 ? 'positive' : 'negative';

    summarySection.innerHTML = `
        <div class="summary-card">
            <h3>Patrimônio Total</h3>
            <p id="portfolio-total-value">${formatCurrency(portfolioTotalValue)}</p>
        </div>
        <div class="summary-card">
            <h3>Custo Total</h3>
            <p>${formatCurrency(portfolioTotalCost)}</p>
        </div>
        <div class="summary-card">
            <h3>Resultado</h3>
            <p class="${resultClass}" id="portfolio-result-container"><span id="portfolio-result-value">${formatCurrency(portfolioResult)}</span> (<span id="portfolio-result-percent">${portfolioResultPercent.toFixed(2)}</span>%)</p>
        </div>
    `;

    assetListEl.innerHTML = '';
    if (assetsToRender.length === 0) {
        assetListEl.innerHTML = '<li class="asset-item-empty">Nenhum ativo cadastrado. Adicione um no formulário abaixo.</li>';
        return;
    }

    assetsToRender.forEach(asset => {
        const li = document.createElement('li');
        li.className = 'asset-item';
        
        const weight = portfolioTotalValue > 0 ? (asset.currentValue / portfolioTotalValue) * 100 : 0;
        const resultClass = asset.resultValue >= 0 ? 'positive' : 'negative';

        li.innerHTML = `
            <div class="asset-info" data-asset-id="${asset.id}">
                <span class="asset-ticker">${asset.ticker}</span>
                <span class="asset-name">${asset.type}</span>
            </div>
            <div class="numeric" id="weight-${asset.id}">
                <span>${weight.toFixed(2)}%</span>
            </div>
            <div class="numeric">
                <span>${asset.quantity}</span>
                <small class="sub-value">PM: ${formatCurrency(asset.averagePrice)}</small>
            </div>
            <div class="numeric">
                <span>${formatCurrency(asset.currentPrice)}</span>
            </div>
            <div class="numeric">
                <span id="market-value-${asset.id}">${formatCurrency(asset.currentValue)}</span>
                <small class="sub-value">Custo: ${formatCurrency(asset.totalInvested)}</small>
            </div>
            <div class="numeric">
                <span class="result ${resultClass}" id="result-value-${asset.id}">${formatCurrency(asset.resultValue)}</span>
                <small class="sub-value result ${resultClass}" id="result-percent-${asset.id}">${asset.resultPercent.toFixed(2)}%</small>
            </div>
            <div class="actions">
                <button class="action-btn add-provento-btn" data-asset-id="${asset.id}" title="Registrar Provento">💲</button>
                <button class="action-btn add-movement-btn" data-asset-id="${asset.id}" title="Adicionar Movimento">➕</button>
                <button class="action-btn edit-btn" data-asset-id="${asset.id}" title="Editar Ativo">&#9998;</button>
                <button class="action-btn delete-btn" data-asset-id="${asset.id}" title="Excluir Ativo">&times;</button>
            </div>
        `;
        assetListEl.appendChild(li);
    });
}

function renderAssetDetailPlaceholders(ticker, name) {
    document.getElementById('detail-asset-ticker').textContent = ticker;
    document.getElementById('detail-asset-name').textContent = name;
    
    document.getElementById('detail-asset-quantity').textContent = '...';
    document.getElementById('detail-asset-avg-price').textContent = '...';
    document.getElementById('detail-asset-market-value').textContent = '...';
    document.getElementById('detail-asset-current-price').textContent = '...';
    document.getElementById('detail-asset-total-result').textContent = '...';
    document.getElementById('detail-asset-total-result-percent').textContent = '...';
    document.getElementById('detail-asset-yoc').textContent = '...';
    document.getElementById('detail-asset-total-proventos').textContent = '...';
    
    document.getElementById('asset-detail-movements-list').innerHTML = '<li>Carregando operações...</li>';
    document.getElementById('asset-detail-proventos-list').innerHTML = '<li>Carregando proventos...</li>';
}

function renderAssetDetailSummaryCards(asset, allMovements, currentPrice) {
    const marketValue = asset.quantity * currentPrice;
    const totalResult = marketValue - asset.totalInvested;
    const totalResultPercent = asset.totalInvested > 0 ? (totalResult / asset.totalInvested) * 100 : 0;
    const proventos = allMovements.filter(m => m.type === 'provento');
    const totalProventos = proventos.reduce((sum, p) => sum + p.totalAmount, 0);

    // Cálculo do Yield on Cost (YOC)
    const yoc = (asset.totalInvested > 0) ? (totalProventos / asset.totalInvested) * 100 : 0;
    
    document.getElementById('detail-asset-quantity').textContent = asset.quantity;
    document.getElementById('detail-asset-avg-price').textContent = formatCurrency(asset.averagePrice);
    document.getElementById('detail-asset-market-value').textContent = formatCurrency(marketValue);
    document.getElementById('detail-asset-current-price').textContent = formatCurrency(currentPrice);
    
    const resultEl = document.getElementById('detail-asset-total-result');
    const resultPercentEl = document.getElementById('detail-asset-total-result-percent');
    resultEl.textContent = formatCurrency(totalResult);
    resultPercentEl.textContent = `${totalResultPercent.toFixed(2)}%`;
    resultEl.parentElement.className = totalResult >= 0 ? 'positive' : 'negative';
    
    document.getElementById('detail-asset-yoc').textContent = `${yoc.toFixed(2)}%`;
    document.getElementById('detail-asset-total-proventos').textContent = formatCurrency(totalProventos);
}

function renderAssetStaticInfo(asset) {
    document.getElementById('detail-asset-type').textContent = asset.type || '--';
    document.getElementById('detail-asset-class').textContent = asset.assetClass || '--';
    document.getElementById('detail-asset-broker').textContent = asset.broker || '--';
    document.getElementById('detail-asset-total-cost').textContent = formatCurrency(asset.totalInvested);
}

function renderAssetDetailOperations(operations) {
    const listEl = document.getElementById('asset-detail-movements-list');
    listEl.innerHTML = '';

    if (operations.length === 0) {
        listEl.innerHTML = '<li class="movement-item-empty">Nenhuma operação de compra ou venda registrada.</li>';
        return;
    }
    
    operations.sort((a,b) => b.date - a.date).forEach(mov => {
        const li = document.createElement('li');
        li.className = 'movement-item';
        const typeLabel = mov.type === 'buy' ? 'Compra' : 'Venda';
        const typeClass = mov.type;

        li.innerHTML = `
            <div>${mov.date.toLocaleDateString('pt-BR')}</div>
            <div><span class="status-badge ${typeClass}">${typeLabel}</span></div>
            <div class="numeric">${mov.quantity}</div>
            <div class="numeric">${formatCurrency(mov.pricePerUnit)}</div>
            <div class="numeric">${formatCurrency(mov.totalCost)}</div>
            <div class="actions">
                <button class="action-btn edit-btn" data-movement-id="${mov.id}" title="Editar" disabled>&#9998;</button>
                <button class="action-btn delete-btn" data-movement-id="${mov.id}" title="Excluir">&times;</button>
            </div>
        `;
        listEl.appendChild(li);
    });
}

function renderAssetDetailProventos(proventos, averagePrice) {
    const containerEl = document.getElementById('asset-detail-proventos-list');
    containerEl.innerHTML = '';
    
    if (proventos.length === 0) {
        containerEl.innerHTML = '<p style="text-align:center; color: #7f8c8d;">Nenhum provento registrado.</p>';
        return;
    }

    let tableHtml = `
        <div class="movement-table-header">
            <div class="header-item">Data</div>
            <div class="header-item">Tipo</div>
            <div class="header-item numeric">Valor Total</div>
            <div class="header-item numeric">Valor por Cota</div>
        </div>
        <ul style="list-style: none; padding: 0;">
    `;

    proventos.sort((a,b) => b.date - a.date).forEach(p => {
        const valuePerShare = p.quantityOnDate > 0 ? p.totalAmount / p.quantityOnDate : 0;
        tableHtml += `
            <li class="movement-item">
                <div>${p.date.toLocaleDateString('pt-BR')}</div>
                <div>${p.proventoType}</div>
                <div class="numeric">${formatCurrency(p.totalAmount)}</div>
                <div class="numeric">${formatCurrency(valuePerShare)}</div>
            </li>
        `;
    });

    tableHtml += '</ul>';
    containerEl.innerHTML = tableHtml;
}

export function openMovementModal(assetId) {
    const asset = _currentPortfolioAssets.find(a => a.id === assetId);
    if (!asset) {
        showNotification("Ativo não encontrado.", "error");
        return;
    }

    movementModalTitle.textContent = `Registrar Operação para ${asset.ticker}`;
    movementAssetIdInput.value = assetId;
    movementDateInput.value = formatDateToInput(new Date());

    const currentPortfolio = state.selectedPortfolioForAssetsView;
    if (currentPortfolio && currentPortfolio.ownershipType === 'third-party') {
        movementAccountWrapper.style.display = 'none';
        movementAccountSelect.required = false;
    } else {
        movementAccountWrapper.style.display = 'block';
        movementAccountSelect.required = true;
        populateAccountSelects();
    }
    
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
    
    const currentPortfolio = state.selectedPortfolioForAssetsView;
    if (currentPortfolio && currentPortfolio.ownershipType === 'third-party') {
        proventoAccountWrapper.style.display = 'none';
        proventoAccountSelect.required = false;
    } else {
        proventoAccountWrapper.style.display = 'block';
        proventoAccountSelect.required = true;
        populateAccountSelects();
    }
    
    proventoModal.style.display = 'flex';
}

export function closeProventoModal() {
    document.getElementById('add-provento-form').reset();
    proventoModal.style.display = 'none';
}

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
    const asset = _currentPortfolioAssets.find(a => a.id === assetId);
    if (!asset) {
        showNotification("Ativo não encontrado.", "error");
        return;
    }

    const form = document.getElementById('edit-asset-form');
    form['edit-asset-id'].value = asset.id;
    form['edit-asset-name'].value = asset.name;
    form['edit-asset-ticker'].value = asset.ticker;
    form['edit-asset-type'].value = asset.type;
    form['edit-asset-class'].value = asset.assetClass;
    form['edit-asset-broker'].value = asset.broker;

    editAssetModal.style.display = 'flex';
}

export function closeEditAssetModal() {
    document.getElementById('edit-asset-form').reset();
    editAssetModal.style.display = 'none';
}

export function openEditMovementModal(movementId) {
    showNotification("Funcionalidade de editar movimento pendente.", "info");
}

export function closeEditMovementModal() {
    document.getElementById('edit-movement-form').reset();
    editMovementModal.style.display = 'none';
}

export async function openUpdateQuotesModal() {
    const listEl = document.getElementById('update-quotes-list');
    listEl.innerHTML = '<li>Carregando ativos...</li>';
    updateQuotesModal.style.display = 'flex';

    try {
        const allAssets = await portfolios.getAllUserAssets(state.currentUser.uid);
        const savedQuotes = await quotes.getSavedQuotes(state.currentUser.uid);

        const uniqueTickers = [...new Set(allAssets.map(a => a.ticker))];

        if (uniqueTickers.length === 0) {
            listEl.innerHTML = '<li>Nenhum ativo cadastrado para atualizar.</li>';
            return;
        }

        listEl.innerHTML = '';
        uniqueTickers.sort().forEach(ticker => {
            const data = savedQuotes[ticker] || {};
            const li = document.createElement('li');
            li.className = 'quote-update-item';
            // Removido o campo de DY (%)
            li.innerHTML = `
                <div class="ticker">${ticker}</div>
                <div class="form-control" style="grid-column: span 2;">
                    <label for="quote-${ticker}">Cotação Atual (R$)</label>
                    <input type="number" id="quote-${ticker}" data-ticker="${ticker}" data-field="currentPrice" step="0.01" value="${data.currentPrice || 0}">
                </div>
            `;
            listEl.appendChild(li);
        });

    } catch(error) {
        showNotification(error.message, 'error');
        listEl.innerHTML = '<li>Erro ao carregar os ativos.</li>';
    }
}

export function closeUpdateQuotesModal() {
    updateQuotesModal.style.display = 'none';
}
