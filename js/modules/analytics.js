// js/modules/analytics.js

// Importa a instância do Firestore e funções necessárias.
import { db } from '../firebase-config.js';
// INÍCIO DA ALTERAÇÃO - Importa as constantes de coleções
import { COLLECTIONS } from '../config/constants.js';
// FIM DA ALTERAÇÃO
import {
    collection,
    query,
    where,
    getDocs,
    Timestamp,
    orderBy
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

/**
 * Busca e agrega as transações dos últimos 'numberOfMonths' meses.
 * @param {string} userId - O ID do usuário.
 * @param {number} numberOfMonths - A quantidade de meses a serem analisados (ex: 6).
 * @returns {Promise<object>} Um objeto contendo arrays de labels (meses), receitas e despesas.
 */
async function getMonthlySummary(userId, numberOfMonths = 6) {
    // 1. Define o período de tempo para a consulta
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - (numberOfMonths - 1));
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    // 2. Cria a consulta ao Firestore
    // INÍCIO DA ALTERAÇÃO
    const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
    // FIM DA ALTERAÇÃO
    const q = query(
        transactionsRef,
        where("userId", "==", userId),
        where("paymentMethod", "in", ["pix", "debit", "cash"]),
        where("date", ">=", Timestamp.fromDate(startDate)),
        where("date", "<=", Timestamp.fromDate(endDate)),
        orderBy("date", "asc")
    );

    // 3. Inicializa a estrutura de dados para o resultado
    const monthlyData = {};
    const labels = [];
    for (let i = 0; i < numberOfMonths; i++) {
        const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const monthYear = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
        labels.push(monthYear);
        monthlyData[monthYear] = { revenue: 0, expense: 0 };
    }

    try {
        // 4. Executa a consulta e processa os resultados
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            const transaction = doc.data();
            const transactionDate = transaction.date.toDate();
            const monthYear = `${(transactionDate.getMonth() + 1).toString().padStart(2, '0')}/${transactionDate.getFullYear()}`;

            if (monthlyData[monthYear]) {
                if (transaction.type === 'revenue') {
                    monthlyData[monthYear].revenue += transaction.amount;
                } else {
                    monthlyData[monthYear].expense += transaction.amount;
                }
            }
        });

        // 5. Formata os dados para o formato que o Chart.js espera
        const revenues = labels.map(label => monthlyData[label].revenue);
        const expenses = labels.map(label => monthlyData[label].expense);

        return { labels, revenues, expenses };

    } catch (error) {
        console.error("Erro ao buscar resumo mensal:", error);
        throw new Error("Não foi possível carregar os dados para o gráfico de evolução.");
    }
}

export { getMonthlySummary };
