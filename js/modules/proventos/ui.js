// js/modules/proventos/ui.js

/**
 * Módulo para gerenciar a interface do usuário (UI) da página de Proventos.
 */

import * as state from '../state.js';
import * as movements from '../investments/movements.js';
import { showNotification } from '../ui/notifications.js';
import { formatCurrency } from '../ui/utils.js';
import * as charts from '../ui/charts.js';

// --- Seleção de Elementos do DOM ---
const summaryCardsContainer = document.getElementById('proventos-summary-cards');
const monthlyChartCanvas = document.getElementById('proventos-monthly-chart');
const assetTableContainer = document.getElementById('proventos-asset-table');

/**
 * Ponto de entrada principal para carregar e renderizar a página de proventos.
 */
export async function loadProventosPage() {
    renderLoadingPlaceholders();

    try {
        const allProventos = await movements.getAllProventos(state.currentUser.uid);
        
        // Processa e agrega os dados
        const summaryData = calculateSummaryData(allProventos);
        const monthlyChartData = prepareMonthlyChartData(allProventos);
        const assetTableData = aggregateProventosByAsset(allProventos);

        // Renderiza os componentes da UI
        renderSummaryCards(summaryData);
        renderMonthlyChart(monthlyChartData);
        renderAssetTable(assetTableData);

    } catch (error) {
        showNotification(error.message, 'error');
        // Renderiza estado de erro nos componentes
        summaryCardsContainer.innerHTML = `<div class="summary-card"><p>Erro ao carregar.</p></div>`;
        assetTableContainer.innerHTML = `<p>Não foi possível carregar os dados de proventos.</p>`;
    }
}

/**
 * Exibe placeholders de "Carregando..." enquanto os dados são buscados.
 */
function renderLoadingPlaceholders() {
    summaryCardsContainer.innerHTML = `
        <div class="summary-card"><h3>Total Recebido</h3><p>...</p></div>
        <div class="summary-card"><h3>Últimos 12 Meses</h3><p>...</p></div>
        <div class="summary-card"><h3>Mês Atual</h3><p>...</p></div>
    `;
    assetTableContainer.innerHTML = `<p>Carregando dados dos ativos...</p>`;
}

/**
 * Calcula os dados para os cards de resumo.
 * @param {Array<object>} proventos - A lista de todos os proventos.
 * @returns {object} - Um objeto com os totais calculados.
 */
function calculateSummaryData(proventos) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    let totalReceived = 0;
    let last12MonthsTotal = 0;
    let currentMonthTotal = 0;

    proventos.forEach(p => {
        totalReceived += p.totalAmount;
        if (p.date >= oneYearAgo) {
            last12MonthsTotal += p.totalAmount;
        }
        if (p.date.getMonth() === currentMonth && p.date.getFullYear() === currentYear) {
            currentMonthTotal += p.totalAmount;
        }
    });

    return { totalReceived, last12MonthsTotal, currentMonthTotal };
}

/**
 * Prepara os dados para o gráfico de evolução mensal.
 * @param {Array<object>} proventos - A lista de todos os proventos.
 * @returns {object} - Um objeto no formato que o Chart.js espera.
 */
function prepareMonthlyChartData(proventos) {
    const monthlyData = {};
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);

    // Inicializa os últimos 12 meses
    for (let i = 0; i < 12; i++) {
        const date = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth() + i, 1);
        const monthYear = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
        monthlyData[monthYear] = 0;
    }

    proventos.forEach(p => {
        if (p.date >= twelveMonthsAgo) {
            const monthYear = `${(p.date.getMonth() + 1).toString().padStart(2, '0')}/${p.date.getFullYear()}`;
            if (monthlyData.hasOwnProperty(monthYear)) {
                monthlyData[monthYear] += p.totalAmount;
            }
        }
    });

    return {
        labels: Object.keys(monthlyData),
        values: Object.values(monthlyData)
    };
}

/**
 * Agrupa os proventos por ativo para a tabela detalhada.
 * @param {Array<object>} proventos - A lista de todos os proventos.
 * @returns {Array<object>} - Uma lista de objetos, cada um representando um ativo com seus proventos.
 */
function aggregateProventosByAsset(proventos) {
    const byAsset = proventos.reduce((acc, p) => {
        if (!acc[p.ticker]) {
            acc[p.ticker] = {
                ticker: p.ticker,
                assetName: p.assetName,
                totalAmount: 0,
                lastProventoDate: new Date(0),
                lastProventoValue: 0,
                records: []
            };
        }
        acc[p.ticker].totalAmount += p.totalAmount;
        acc[p.ticker].records.push(p);
        if (p.date > acc[p.ticker].lastProventoDate) {
            acc[p.ticker].lastProventoDate = p.date;
            acc[p.ticker].lastProventoValue = p.totalAmount;
        }
        return acc;
    }, {});

    return Object.values(byAsset).sort((a, b) => b.totalAmount - a.totalAmount);
}


// --- Funções de Renderização ---

/**
 * Renderiza os cards de resumo com os dados calculados.
 * @param {object} data - O objeto retornado por calculateSummaryData.
 */
function renderSummaryCards(data) {
    summaryCardsContainer.innerHTML = `
        <div class="summary-card">
            <h3>Total Recebido</h3>
            <p>${formatCurrency(data.totalReceived)}</p>
        </div>
        <div class="summary-card">
            <h3>Últimos 12 Meses</h3>
            <p>${formatCurrency(data.last12MonthsTotal)}</p>
        </div>
        <div class="summary-card">
            <h3>Mês Atual</h3>
            <p>${formatCurrency(data.currentMonthTotal)}</p>
        </div>
    `;
}

/**
 * Renderiza o gráfico de evolução mensal.
 * @param {object} chartData - O objeto retornado por prepareMonthlyChartData.
 */
function renderMonthlyChart(chartData) {
    charts.renderProventosMonthlyChart(chartData);
}

/**
 * Renderiza a tabela de proventos agrupados por ativo.
 * @param {Array<object>} assetData - A lista de ativos com proventos agregados.
 */
function renderAssetTable(assetData) {
    if (assetData.length === 0) {
        assetTableContainer.innerHTML = `<p>Nenhum provento registrado no período.</p>`;
        return;
    }

    // Cria o cabeçalho da tabela
    let tableHtml = `
        <div class="asset-table-header">
            <div class="header-item asset-info">Ativo</div>
            <div class="header-item numeric">Último Provento</div>
            <div class="header-item numeric">Total Acumulado</div>
        </div>
        <ul id="proventos-asset-list" style="list-style: none; padding: 0;">
    `;

    // Cria as linhas da tabela
    assetData.forEach(asset => {
        tableHtml += `
            <li class="asset-item">
                <div class="asset-info">
                    <span class="asset-ticker">${asset.ticker}</span>
                    <span class="asset-name">${asset.assetName}</span>
                </div>
                <div class="numeric">
                    <span>${formatCurrency(asset.lastProventoValue)}</span>
                    <small class="sub-value">${asset.lastProventoDate.toLocaleDateString('pt-BR')}</small>
                </div>
                <div class="numeric">
                    <span>${formatCurrency(asset.totalAmount)}</span>
                </div>
            </li>
        `;
    });

    tableHtml += `</ul>`;
    assetTableContainer.innerHTML = tableHtml;
}
