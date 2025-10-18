// js/modules/ui/charts.js

/**
 * Módulo responsável por renderizar e gerenciar os gráficos da aplicação (Chart.js).
 */

import * as state from '../state.js';
import { unpackSplitTransactions } from '../analytics.js';

// --- Seleção de Elementos do DOM ---
const chartCanvas = document.getElementById('expenses-chart');
const trendsChartCanvas = document.getElementById('trends-chart');
const invoiceSpendingChartCanvas = document.getElementById('invoice-spending-chart');
const rentabilidadeChartCanvas = document.getElementById('rentabilidade-chart');
const composicaoChartCanvas = document.getElementById('composicao-chart');
const patrimonioChartCanvas = document.getElementById('patrimonio-chart');
// INÍCIO DA ALTERAÇÃO
const proventosMonthlyChartCanvas = document.getElementById('proventos-monthly-chart');
// FIM DA ALTERAÇÃO

/**
 * Renderiza o gráfico de despesas por categoria (tipo 'pie').
 * @param {Array<object>} transactions - A lista de transações a ser analisada.
 */
export function renderExpensesChart(transactions) {
    // Desdobra as transações divididas para garantir que os cálculos sejam feitos nas categorias corretas.
    const unpackedTransactions = unpackSplitTransactions(transactions);

    const expenses = unpackedTransactions.filter(t => t.type === 'expense');

    const spendingByCategory = expenses.reduce((acc, transaction) => {
        const { category, amount } = transaction;
        if (!acc[category]) {
            acc[category] = 0;
        }
        acc[category] += amount;
        return acc;
    }, {});

    const labels = Object.keys(spendingByCategory);
    const data = Object.values(spendingByCategory);

    // Destrói a instância anterior do gráfico, se existir
    if (state.expensesChart) {
        state.expensesChart.destroy();
    }

    // Não renderiza o gráfico se não houver dados
    if (labels.length === 0) {
        state.setExpensesChart(null); // Garante que a referência seja limpa
        return;
    }

    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Despesas por Categoria',
            data: data,
            backgroundColor: labels.map(() => `hsl(${Math.random() * 360}, 70%, 50%)`),
            hoverOffset: 4
        }]
    };

    const newChart = new Chart(chartCanvas, {
        type: 'pie',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        // Define a cor do texto da legenda com base no tema atual
                        color: document.body.classList.contains('dark-mode') ? '#bdc3c7' : '#34495e'
                    }
                }
            }
        }
    });

    // Salva a nova instância do gráfico no estado global
    state.setExpensesChart(newChart);
}

/**
 * Renderiza o gráfico de evolução mensal de receitas e despesas (tipo 'bar').
 * @param {object} summaryData - Os dados agregados contendo { labels, revenues, expenses }.
 */
export function renderTrendsChart(summaryData) {
    // Destrói a instância anterior do gráfico, se existir
    if (state.trendsChart) {
        state.trendsChart.destroy();
    }

    const data = {
        labels: summaryData.labels,
        datasets: [
            {
                label: 'Receitas',
                data: summaryData.revenues,
                backgroundColor: 'rgba(46, 204, 113, 0.7)',
                borderColor: 'rgba(46, 204, 113, 1)',
                borderWidth: 1
            },
            {
                label: 'Despesas',
                data: summaryData.expenses,
                backgroundColor: 'rgba(231, 76, 60, 0.7)',
                borderColor: 'rgba(231, 76, 60, 1)',
                borderWidth: 1
            }
        ]
    };

    const textColor = document.body.classList.contains('dark-mode') ? '#bdc3c7' : '#34495e';

    const newChart = new Chart(trendsChartCanvas, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: textColor
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: textColor
                    },
                    grid: {
                        color: textColor.replace('rgb', 'rgba').replace(')', ', 0.1)')
                    }
                },
                x: {
                    ticks: {
                        color: textColor
                    },
                    grid: {
                        color: 'transparent'
                    }
                }
            }
        }
    });

    // Salva a nova instância do gráfico no estado global
    state.setTrendsChart(newChart);
}

/**
 * Renderiza o gráfico de gastos por categoria para uma fatura específica.
 * @param {Array<object>} invoiceTransactions - A lista de transações da fatura.
 */
export function renderInvoiceSpendingChart(invoiceTransactions) {
    const spendingByCategory = invoiceTransactions.reduce((acc, transaction) => {
        const { category, amount } = transaction;
        if (!acc[category]) {
            acc[category] = 0;
        }
        acc[category] += amount;
        return acc;
    }, {});

    const labels = Object.keys(spendingByCategory);
    const data = Object.values(spendingByCategory);

    if (state.invoiceSpendingChart) {
        state.invoiceSpendingChart.destroy();
    }

    if (labels.length === 0) {
        state.setInvoiceSpendingChart(null);
        return;
    }

    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Gastos na Fatura',
            data: data,
            backgroundColor: labels.map((_, index) => `hsl(${(index * 40) % 360}, 70%, 50%)`),
            hoverOffset: 4
        }]
    };

    const newChart = new Chart(invoiceSpendingChartCanvas, {
        type: 'pie',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: document.body.classList.contains('dark-mode') ? '#bdc3c7' : '#34495e'
                    }
                }
            }
        }
    });

    state.setInvoiceSpendingChart(newChart);
}



/**
 * Renderiza o gráfico de rentabilidade da carteira (tipo 'line').
 * @param {object} data - Dados de rentabilidade (placeholder).
 */
export function renderRentabilidadeChart(data) {
    if (state.rentabilidadeChart) {
        state.rentabilidadeChart.destroy();
    }
    
    // Dados de exemplo para visualização
    const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Carteira',
            data: [0, 2, 1, 3, 5, 6],
            borderColor: 'rgb(52, 152, 219)',
            tension: 0.1
        },
        {
            label: 'IBOVESPA',
            data: [1, 1.5, 2.5, 2, 4, 4.5],
            borderColor: 'rgb(231, 76, 60)',
            tension: 0.1
        }]
    };
    
    const textColor = document.body.classList.contains('dark-mode') ? '#bdc3c7' : '#34495e';

    const newChart = new Chart(rentabilidadeChartCanvas, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: textColor } } },
            scales: {
                y: { ticks: { color: textColor }, grid: { color: 'rgba(127,127,127,0.2)' } },
                x: { ticks: { color: textColor }, grid: { color: 'transparent' } }
            }
        }
    });

    state.setRentabilidadeChart(newChart);
}

/**
 * Renderiza o gráfico de composição da carteira (tipo 'doughnut').
 * @param {object} data - Dados de composição, contendo { labels, values }.
 */
export function renderComposicaoChart(data) {
    if (state.composicaoChart) {
        state.composicaoChart.destroy();
    }
    
    // Se não houver dados, não renderiza o gráfico.
    if (!data || !data.labels || data.labels.length === 0) {
        composicaoChartCanvas.getContext('2d').clearRect(0, 0, composicaoChartCanvas.width, composicaoChartCanvas.height);
        state.setComposicaoChart(null);
        return;
    }

    const chartData = {
        labels: data.labels,
        datasets: [{
            label: 'Composição',
            data: data.values,
            backgroundColor: [
                '#3498db', '#2ecc71', '#95a5a6', '#f1c40f', '#e74c3c', '#9b59b6'
            ],
            hoverOffset: 4
        }]
    };

    const newChart = new Chart(composicaoChartCanvas, {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: document.body.classList.contains('dark-mode') ? '#bdc3c7' : '#34495e'
                    }
                }
            }
        }
    });

    state.setComposicaoChart(newChart);
}

/**
 * Renderiza o gráfico de evolução do patrimônio (tipo 'bar').
 * @param {object} data - Dados do patrimônio (placeholder).
 */
export function renderPatrimonioChart(data) {
    if (state.patrimonioChart) {
        state.patrimonioChart.destroy();
    }
    
    // Dados de exemplo
    const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Patrimônio',
            data: [1000, 1200, 1100, 1500, 1800, 2000],
            backgroundColor: 'rgba(44, 62, 80, 0.7)',
        }]
    };
    
    const textColor = document.body.classList.contains('dark-mode') ? '#bdc3c7' : '#34495e';

    const newChart = new Chart(patrimonioChartCanvas, {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }, // Oculta a legenda para um visual mais limpo
            scales: {
                y: { display: false }, // Oculta o eixo Y
                x: { ticks: { color: textColor }, grid: { color: 'transparent' } }
            }
        }
    });

    state.setPatrimonioChart(newChart);
}

// --- INÍCIO DA ALTERAÇÃO ---
/**
 * Renderiza o gráfico de evolução mensal de proventos (tipo 'bar').
 * @param {object} chartData - Objeto com { labels, values }.
 */
export function renderProventosMonthlyChart(chartData) {
    if (state.proventosMonthlyChart) {
        state.proventosMonthlyChart.destroy();
    }

    const data = {
        labels: chartData.labels,
        datasets: [{
            label: 'Proventos Recebidos',
            data: chartData.values,
            backgroundColor: 'rgba(46, 204, 113, 0.7)',
            borderColor: 'rgba(46, 204, 113, 1)',
            borderWidth: 1
        }]
    };

    const textColor = document.body.classList.contains('dark-mode') ? '#bdc3c7' : '#34495e';

    const newChart = new Chart(proventosMonthlyChartCanvas, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Legenda é redundante aqui
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: textColor
                    },
                    grid: {
                        color: textColor.replace('rgb', 'rgba').replace(')', ', 0.1)')
                    }
                },
                x: {
                    ticks: {
                        color: textColor
                    },
                    grid: {
                        color: 'transparent'
                    }
                }
            }
        }
    });

    state.setProventosMonthlyChart(newChart);
}
// --- FIM DA ALTERAÇÃO ---
