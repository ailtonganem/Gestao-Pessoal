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
let _currentAssetMovements = [];

// --- Seleção de Elementos do DOM ---
const investmentDashboardView = document.getElementById('investment-dashboard-view');
const portfoliosManagementView = document.getElementById('portfolios-management-view');
const portfolioFilterSelect = document.getElementById('portfolio-filter-select');

// Cards do Dashboard
const rentabilidadeCard = document.getElementById('rentabilidade-card');
const composicaoCard = document.getElementById('composicao-card');
const calendarioCard = document.getElementById('calendario-card');
const patrimonioCard = document.getElementById('patrimonio-card');
// INÍCIO DA ALTERAÇÃO
const proventosMesCard = document.getElementById('proventos-mes-card');
const resultadoMesCard = document.getElementById('resultado-mes-card');
// FIM DA ALTERAÇÃO
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

const movementsView = document.getElementById('movements-view');
const movementsAssetNameEl = document.getElementById('movements-asset-name');
const movementsListEl = document.getElementById('movements-list');

// Modais de Edição
const editPortfolioModal = document.getElementById('edit-portfolio-modal');
const editAssetModal = document.getElementById('edit-asset-modal');
const editMovementModal = document.getElementById('edit-movement-modal');


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
    await loadAndRenderPortfolios(); // Garante que as carteiras sejam carregadas ao entrar na tela.
}


/**
 * Exibe a visualização de gerenciamento de carteiras (dentro da tela de gerenciamento).
 */
export function showPortfoliosView() {
    portfoliosView.style.display = 'block';
    assetsView.style.display = 'none';
    movementsView.style.display = 'none';
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
    movementsView.style.display = 'none';
    await loadAndRenderAssets(portfolio.id); 
}

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
    
    // Adiciona a carteira ao objeto de ativo selecionado para referência futura
    asset.portfolioId = state.selectedPortfolioForAssetsView.id;
    state.setSelectedAssetForMovementsView(asset);
    
    const assetHeaderDetails = document.querySelector('.asset-header-details');
    assetHeaderDetails.querySelector('h2').textContent = `${asset.ticker} - ${asset.name}`;
    assetHeaderDetails.querySelector('p').textContent = `${asset.type} - ${asset.broker || 'N/A'}`;
    
    assetsView.style.display = 'none';
    movementsView.style.display = 'block';

    await loadAndRenderMovements(asset);
}

/**
 * Recarrega e renderiza a view de movimentos para o ativo atualmente selecionado.
 */
export async function refreshMovementsView() {
    const currentAsset = state.selectedAssetForMovementsView;
    if (!currentAsset) return;

    // Recarrega todos os ativos da carteira para obter os dados atualizados
    await loadAndRenderAssets(currentAsset.portfolioId);
    // Encontra o ativo atualizado na lista recarregada
    const updatedAsset = _currentPortfolioAssets.find(a => a.id === currentAsset.id);

    if (updatedAsset) {
        // Atualiza o estado global com o ativo atualizado
        state.setSelectedAssetForMovementsView(updatedAsset);
        // Renderiza a tela de movimentos com os novos dados
        await loadAndRenderMovements(updatedAsset);
    } else {
        // Se o ativo foi deletado (não encontrado), volta para a lista de ativos
        showAssetsView(state.selectedPortfolioForAssetsView);
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
            // Garante que o ID da carteira esteja presente em cada ativo
            assetsToDisplay.forEach(asset => asset.portfolioId = portfolioId);
        }

        const tickers = assetsToDisplay.map(asset => asset.ticker);
        const quotes = await getQuotes(tickers);

        assetsToDisplay.forEach(asset => {
            if (quotes[asset.ticker]) {
                asset.currentValue = quotes[asset.ticker] * asset.quantity;
            } else {
                // Se não houver cotação, usa o valor investido como valor atual
                asset.currentValue = asset.totalInvested;
            }
        });
        
        // Busca os movimentos de todos os ativos para o histórico
        const movementPromises = assetsToDisplay.map(async (asset) => {
            const assetMovements = await movements.getMovements(asset.portfolioId, asset.id);
            return assetMovements.map(m => ({ ...m, ticker: asset.ticker }));
        });
        
        const allMovementsNested = await Promise.all(movementPromises);
        const allMovementsFlat = allMovementsNested.flat();
        allMovementsFlat.sort((a, b) => b.date - a.date); // Ordena pela data mais recente

        const totalPatrimonio = assetsToDisplay.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);
        
        // Agrega dados para o gráfico de composição
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

        // Renderiza os cards do dashboard com os dados agregados
        renderPatrimonioCard(aggregatedData);
        renderComposicaoCard(aggregatedData);
        renderInvestmentHistory(aggregatedData);
        
        // (Placeholders para funcionalidades futuras)
        renderRentabilidadeCard({});
        renderCalendarioCard({});
        renderProventosMesCard({});
        renderResultadoMesCard({});

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
// INÍCIO DA ALTERAÇÃO
function renderLoadingPlaceholders() {
    rentabilidadeCard.querySelector('.chart-container').innerHTML = `<p>Carregando dados de rentabilidade...</p>`;
    composicaoCard.querySelector('.chart-container').innerHTML = `<p>Carregando composição...</p>`;
    calendarioCard.querySelector('#proventos-calendar').innerHTML = `<p>Carregando calendário...</p>`;
    patrimonioCard.querySelector('.chart-container').innerHTML = `<p>Carregando patrimônio...</p>`;
    document.getElementById('patrimonio-total-valor').textContent = '...';
    proventosMesCard.querySelector('#proventos-mes-summary').innerHTML = `<p>Carregando...</p>`;
    resultadoMesCard.querySelector('#resultado-mes-summary').innerHTML = `<p>Carregando...</p>`;
    investmentHistoryCard.querySelector('#investment-history-list').innerHTML = `<li>Carregando histórico...</li>`;
}
// FIM DA ALTERAÇÃO

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

// INÍCIO DA ALTERAÇÃO
function renderProventosMesCard(data) {
    proventosMesCard.querySelector('#proventos-mes-summary').innerHTML = `<p id="proventos-mes-total" style="font-size: 1.5rem; font-weight: bold; margin-top: 1rem;">${formatCurrency(0)}</p>`;
}

function renderResultadoMesCard(data) {
    resultadoMesCard.querySelector('#resultado-mes-summary').innerHTML = `<p id="resultado-mes-total" style="font-size: 1.5rem; font-weight: bold; margin-top: 1rem;">${formatCurrency(0)}</p>`;
}
// FIM DA ALTERAÇÃO

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
        const userAssets = await assets.getAssets(portfolioId);

        const tickers = userAssets.map(asset => asset.ticker);
        const quotes = await getQuotes(tickers);

        let portfolioTotalValue = 0;
        let portfolioTotalCost = 0;

        userAssets.forEach(asset => {
            const quote = quotes[asset.ticker];
            asset.currentPrice = quote || (asset.quantity > 0 ? asset.averagePrice : 0);
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
            <p>${formatCurrency(portfolioTotalValue)}</p>
        </div>
        <div class="summary-card">
            <h3>Custo Total</h3>
            <p>${formatCurrency(portfolioTotalCost)}</p>
        </div>
        <div class="summary-card">
            <h3>Resultado</h3>
            <p class="${resultClass}">${formatCurrency(portfolioResult)} (${portfolioResultPercent.toFixed(2)}%)</p>
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
            <div class="numeric">
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
                <span>${formatCurrency(asset.currentValue)}</span>
                <small class="sub-value">Custo: ${formatCurrency(asset.totalInvested)}</small>
            </div>
            <div class="numeric">
                <span class="result ${resultClass}">${formatCurrency(asset.resultValue)}</span>
                <small class="sub-value result ${resultClass}">${asset.resultPercent.toFixed(2)}%</small>
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

async function loadAndRenderMovements(asset) {
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
        movementsListEl.innerHTML = '<li class="movement-item-empty">Nenhuma operação registrada para este ativo.</li>';
        return;
    }
    movementsToRender.forEach(mov => {
        const li = document.createElement('li');
        li.className = 'movement-item';

        let typeLabel = '';
        let typeClass = '';
        let quantity = '';
        let price = '';
        let total = '';

        switch(mov.type) {
            case 'buy':
            case 'sell':
                typeLabel = mov.type === 'buy' ? 'Compra' : 'Venda';
                typeClass = mov.type;
                quantity = mov.quantity;
                price = formatCurrency(mov.pricePerUnit);
                total = formatCurrency(mov.totalCost);
                break;
            case 'provento':
                typeLabel = mov.proventoType;
                typeClass = 'provento';
                quantity = '-';
                price = '-';
                total = formatCurrency(mov.totalAmount);
                break;
        }

        li.innerHTML = `
            <div>${mov.date.toLocaleDateString('pt-BR')}</div>
            <div><span class="status-badge ${typeClass}">${typeLabel}</span></div>
            <div class="numeric">${quantity}</div>
            <div class="numeric">${price}</div>
            <div class="numeric">${total}</div>
            <div class="actions">
                <button class="action-btn edit-btn" data-movement-id="${mov.id}" title="Editar" ${mov.type === 'provento' ? 'disabled' : ''}>&#9998;</button>
                <button class="action-btn delete-btn" data-movement-id="${mov.id}" title="Excluir" ${!mov.transactionId ? 'disabled' : ''}>&times;</button>
            </div>
        `;
        movementsListEl.appendChild(li);
    });
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
