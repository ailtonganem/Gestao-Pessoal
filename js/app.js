// Importa as funções de autenticação e o monitor de estado do nosso módulo auth.
import { registerUser, loginUser, logoutUser, monitorAuthState } from './modules/auth.js';
// ATUALIZAÇÃO: Importa ambas as funções do nosso módulo db.
import { addTransaction, getTransactions } from './modules/db.js';

// --- Variável de Estado ---
// Armazena o objeto do usuário atualmente logado.
let currentUser = null;

// --- Seleção de Elementos do DOM ---
// Contêineres principais
const loadingDiv = document.getElementById('loading');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');

// Seções de formulário de autenticação
const loginSection = document.getElementById('login-form');
const registerSection = document.getElementById('register-form');

// Formulários
const loginForm = loginSection.querySelector('form');
const registerForm = registerSection.querySelector('form');

// Inputs de autenticação
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');

// Links e Botões de autenticação
const showRegisterLink = document.getElementById('show-register-link');
const showLoginLink = document.getElementById('show-login-link');
const logoutButton = document.getElementById('logout-button');

// Elementos do formulário de transação
const addTransactionForm = document.getElementById('add-transaction-form');
const transactionDescriptionInput = document.getElementById('transaction-description');
const transactionAmountInput = document.getElementById('transaction-amount');

// ADIÇÃO: Elementos do Dashboard
const totalRevenueEl = document.getElementById('total-revenue');
const totalExpensesEl = document.getElementById('total-expenses');
const finalBalanceEl = document.getElementById('final-balance');
const transactionsListEl = document.getElementById('transactions-list');


// --- Funções de Manipulação da UI ---

/** Formata um número para o padrão de moeda BRL. */
function formatCurrency(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Renderiza o dashboard: calcula totais e exibe a lista de transações.
 * @param {Array} transactions - A lista de transações do usuário.
 */
function updateDashboard(transactions) {
    let totalRevenue = 0;
    let totalExpenses = 0;

    // Limpa a lista atual na tela
    transactionsListEl.innerHTML = '';

    if (transactions.length === 0) {
        transactionsListEl.innerHTML = '<li>Nenhuma transação registrada.</li>';
    } else {
        transactions.forEach(transaction => {
            if (transaction.type === 'revenue') {
                totalRevenue += transaction.amount;
            } else {
                totalExpenses += transaction.amount;
            }

            // Cria o elemento <li> para a transação
            const li = document.createElement('li');
            li.classList.add(transaction.type); // Adiciona classe 'revenue' ou 'expense'

            const descriptionSpan = document.createElement('span');
            descriptionSpan.className = 'transaction-description';
            descriptionSpan.textContent = transaction.description;

            const amountSpan = document.createElement('span');
            amountSpan.className = 'transaction-amount';
            amountSpan.textContent = formatCurrency(transaction.amount);

            li.appendChild(descriptionSpan);
            li.appendChild(amountSpan);
            transactionsListEl.appendChild(li);
        });
    }

    // Calcula o saldo final
    const finalBalance = totalRevenue - totalExpenses;

    // Atualiza os cards de resumo na tela
    totalRevenueEl.textContent = formatCurrency(totalRevenue);
    totalExpensesEl.textContent = formatCurrency(totalExpenses);
    finalBalanceEl.textContent = formatCurrency(finalBalance);
}

/** Busca os dados do usuário e chama a função para atualizar o dashboard. */
async function loadUserDashboard() {
    if (!currentUser) return;
    try {
        const transactions = await getTransactions(currentUser.uid);
        updateDashboard(transactions);
    } catch (error) {
        console.error("Erro ao carregar o dashboard:", error);
        alert("Não foi possível carregar seus dados.");
    }
}


/** Esconde todos os contêineres principais e exibe o de carregamento. */
function showLoading() {
    loadingDiv.style.display = 'block';
    authContainer.style.display = 'none';
    appContainer.style.display = 'none';
}

/** Exibe a tela de autenticação e esconde as demais. */
function showAuthForms() {
    loadingDiv.style.display = 'none';
    authContainer.style.display = 'block';
    appContainer.style.display = 'none';
}

/** Exibe o painel principal da aplicação e esconde as demais. */
function showApp() {
    loadingDiv.style.display = 'none';
    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
}

// ... (as demais funções de UI, como toggleAuthForms, permanecem as mesmas)
/** Alterna a visualização entre o formulário de login e o de cadastro. */
function toggleAuthForms(showRegister) {
    if (showRegister) {
        loginSection.style.display = 'none';
        registerSection.style.display = 'block';
    } else {
        loginSection.style.display = 'block';
        registerSection.style.display = 'none';
    }
}


// --- Lógica de Negócios e Eventos ---

// ... (os event listeners de auth permanecem os mesmos)
showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(true); });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(false); });
loginForm.addEventListener('submit', async (e) => { e.preventDefault(); try { await loginUser(loginEmailInput.value, loginPasswordInput.value); loginForm.reset(); } catch (error) { alert(`Erro ao fazer login: ${error.message}`); } });
registerForm.addEventListener('submit', async (e) => { e.preventDefault(); try { await registerUser(registerEmailInput.value, registerPasswordInput.value); registerForm.reset(); } catch (error) { alert(`Erro ao cadastrar: ${error.message}`); } });
logoutButton.addEventListener('click', () => { logoutUser().catch(error => { alert(`Erro ao fazer logout: ${error.message}`); }); });

// Event listener para a submissão do formulário de nova transação
addTransactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) { alert("Você precisa estar logado para adicionar uma transação."); return; }

    const description = transactionDescriptionInput.value;
    const amount = parseFloat(transactionAmountInput.value);
    const type = document.querySelector('input[name="transaction-type"]:checked').value;

    const transactionData = { description, amount, type, userId: currentUser.uid };

    try {
        await addTransaction(transactionData);
        addTransactionForm.reset();
        loadUserDashboard(); // ATUALIZAÇÃO: Recarrega o dashboard com os novos dados.
    } catch (error) {
        alert(`Erro ao adicionar transação: ${error.message}`);
    }
});


// --- Ponto de Entrada da Aplicação ---

/** Função principal que inicializa o monitoramento de estado de autenticação. */
function initializeApp() {
    showLoading();
    monitorAuthState((user) => {
        if (user) {
            currentUser = user;
            showApp();
            loadUserDashboard(); // ATUALIZAÇÃO: Carrega os dados do usuário ao logar.
        } else {
            currentUser = null;
            showAuthForms();
            toggleAuthForms(false);
        }
    });
}

// Inicia a aplicação.
initializeApp();
