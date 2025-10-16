// js/modules/investments/ui.js

/**
 * Módulo para gerenciar a interface do usuário (UI) do modal de investimentos.
 * Controla a abertura, fechamento, troca de visualizações e renderização de dados.
 */

import * as state from '../state.js';
import * as portfolios from './portfolios.js';
import * as assets from './assets.js';
import { showNotification } from '../ui/notifications.js';
import { formatCurrency, formatDateToInput } from '../ui/utils.js';
import { populateAccountSelects } from '../ui/render.js';
// INÍCIO DA ALTERAÇÃO - Import de charts
import * as charts from '../ui/charts.js';
// FIM DA ALTERAÇÃO

// --- Variáveis de Estado do Módulo ---
let _currentPortfolioAssets = [];

// --- Seleção de Elementos do DOM ---
// INÍCIO DA ALTERAÇÃO - Novos seletores
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

// FIM DA ALTERAÇÃO

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


// INÍCIO DA ALTERAÇÃO - Funções de Gerenciamento de Views

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

// FIM DA ALTERAÇÃO


/**
 * Exibe a visualização de gerenciamento de carteiras (dentro da tela de gerenciamento).
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

// INÍCIO DA ALTERAÇÃO - Novas Funções de Orquestração do Dashboard

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
    // Exibe placeholders de carregamento
    renderLoadingPlaceholders();

    // Lógica para buscar os dados consolidados ou de uma carteira específica
    // (Será implementada nos próximos passos)
    const aggregatedData = { portfolioId }; // Placeholder

    // Renderiza cada card com os dados agregados
    renderRentabilidadeCard(aggregatedData);
    renderComposicaoCard(aggregatedData);
    renderCalendarioCard(aggregatedData);
    renderPatrimonioCard(aggregatedData);
    renderProventosCard(aggregatedData);
    renderAltasBaixasCard(aggregatedData);
    renderInvestmentHistory(aggregatedData);
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
    proventosCard.querySelector('#proventos-summary').innerHTML = `<p>Carregando proventos...</p>`;
    altasBaixasCard.querySelector('#altas-baixas-list').innerHTML = `<p>Carregando...</p>`;
    investmentHistoryCard.querySelector('#investment-history-list').innerHTML = `<li>Carregando histórico...</li>`;
}

// --- Funções de Renderização dos Cards (Placeholders) ---

function renderRentabilidadeCard(data) {
    // Lógica para renderizar o gráfico de rentabilidade
    const canvas = document.createElement('canvas');
    canvas.id = 'rentabilidade-chart';
    rentabilidadeCard.querySelector('.chart-container').innerHTML = '';
    rentabilidadeCard.querySelector('.chart-container').appendChild(canvas);
    charts.renderRentabilidadeChart(data); // Chamará a função real do charts.js
}

function renderComposicaoCard(data) {
    // Lógica para renderizar o gráfico de composição
    const canvas = document.createElement('canvas');
    canvas.id = 'composicao-chart';
    composicaoCard.querySelector('.chart-container').innerHTML = '';
    composicaoCard.querySelector('.chart-container').appendChild(canvas);
    charts.renderComposicaoChart(data); // Chamará a função real do charts.js
}

function renderCalendarioCard(data) {
    // Lógica para renderizar o calendário de proventos
    calendarioCard.querySelector('#proventos-calendar').innerHTML = `<p>Funcionalidade de Calendário a ser implementada.</p>`;
}

function renderPatrimonioCard(data) {
    // Lógica para renderizar o gráfico e valor do patrimônio
    const canvas = document.createElement('canvas');
    canvas.id = 'patrimonio-chart';
    patrimonioCard.querySelector('.chart-container').innerHTML = '';
    patrimonioCard.querySelector('.chart-container').appendChild(canvas);
    charts.renderPatrimonioChart(data); // Chamará a função real do charts.js
    document.getElementById('patrimonio-total-valor').textContent = formatCurrency(223370.20); // Valor de exemplo
}

function renderProventosCard(data) {
    // Lógica para renderizar o resumo de proventos
    proventosCard.querySelector('#proventos-summary').innerHTML = `<p>Funcionalidade de Proventos a ser implementada.</p>`;
}

function renderAltasBaixasCard(data) {
    // Lógica para renderizar a lista de altas e baixas
    altasBaixasCard.querySelector('#altas-baixas-list').innerHTML = `<p>Funcionalidade de Altas/Baixas a ser implementada.</p>`;
}

function renderInvestmentHistory(data) {
    // Lógica para renderizar o histórico de operações
    investmentHistoryCard.querySelector('#investment-history-list').innerHTML = `<li>Histórico de Operações a ser implementado.</li>`;
}

// FIM DA ALTERAÇÃO


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

/**
 * Busca os dados dos ativos de uma carteira e chama a função para renderizá-los.
 * @param {string} portfolioId - O ID da carteira da qual carregar os ativos.
 */
export async function loadAndRenderAssets(portfolioId) {
    assetListEl.innerHTML = '<li>Carregando ativos...</li>';
    try {
        const userAssets = await assets.getAssets(portfolioId);
        _currentPortfolioAssets = userAssets; // Armazena os ativos carregados
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
        li.className = 'asset-item';

        li.innerHTML = `
            <div class="asset-info">
                <span class="asset-ticker">${asset.ticker}</span>
                <span class="asset-name">${asset.name}</span>
                <small class="asset-type">${asset.type} - ${asset.broker || 'N/A'}</small>
            </div>
            <div class="asset-summary">
                <span class="asset-value">${formatCurrency(asset.currentValue)}</span>
                <small class="asset-quantity">${asset.quantity} Cotas</small>
            </div>
            <div class="asset-actions">
                <button class="action-btn add-movement-btn" data-asset-id="${asset.id}" title="Adicionar Movimento (Compra/Venda)">➕</button>
                <button class="action-btn edit-btn" data-asset-id="${asset.id}" title="Editar Ativo">&#9998;</button>
                <button class="action-btn delete-btn" data-asset-id="${asset.id}" title="Excluir Ativo">&times;</button>
            </div>
        `;
        assetListEl.appendChild(li);
    });
}


/**
 * Abre o modal para registrar uma nova operação (movimento) para um ativo.
 * @param {string} assetId - O ID do ativo para o qual o movimento será registrado.
 */
export function openMovementModal(assetId) {
    const asset = _currentPortfolioAssets.find(a => a.id === assetId);
    if (!asset) {
        showNotification("Ativo não encontrado.", "error");
        return;
    }

    movementModalTitle.textContent = `Registrar Operação para ${asset.ticker}`;
    movementAssetIdInput.value = assetId;
    movementDateInput.value = formatDateToInput(new Date());

    // Popula o select de contas
    populateAccountSelects(movementAccountSelect);
    
    movementModal.style.display = 'flex';
}

/**
 * Fecha o modal de registro de movimento.
 */
export function closeMovementModal() {
    document.getElementById('add-movement-form').reset();
    movementModal.style.display = 'none';
}
