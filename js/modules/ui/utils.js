// js/modules/ui/utils.js

/**
 * Módulo com funções utilitárias para formatação de dados.
 */

/**
 * Formata um número para o padrão de moeda BRL.
 * @param {number} value O valor a ser formatado.
 * @returns {string} A string formatada como R$ 0,00.
 */
export function formatCurrency(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formata um objeto Date para uma string no formato 'YYYY-MM-DD'.
 * @param {Date} date O objeto Date a ser formatado.
 * @returns {string} A string no formato YYYY-MM-DD.
 */
export function formatDateToInput(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}
