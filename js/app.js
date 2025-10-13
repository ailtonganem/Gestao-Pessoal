// Importa as funções de autenticação e o monitor de estado do nosso módulo auth.
import { registerUser, loginUser, logoutUser, monitorAuthState } from './modules/auth.js';
// ADIÇÃO: Importa a função para adicionar transações do nosso módulo db.
import { addTransaction } from './modules/db.js';

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

// ADIÇÃO: Elementos do formulário de transação
const addTransactionForm = document.getElementById('add-transaction-form');
const transactionDescriptionInput = document.getElementById('transaction-description');
const transactionAmountInput = document.getElementById('transaction-amount');

// --- Funções de Manipulação da UI ---

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

// Event listener para o link "Cadastre-se"
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthForms(true);
});

// Event listener para o link "Faça Login"
showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthForms(false);
});

// Event listener para a submissão do formulário de login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    try {
        await loginUser(email, password);
        loginForm.reset();
    } catch (error) {
        alert(`Erro ao fazer login: ${error.message}`);
    }
});

// Event listener para a submissão do formulário de cadastro
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = registerEmailInput.value;
    const password = registerPasswordInput.value;
    try {
        await registerUser(email, password);
        registerForm.reset();
    } catch (error) {
        alert(`Erro ao cadastrar: ${error.message}`);
    }
});

// Event listener para o botão de logout
logoutButton.addEventListener('click', () => {
    logoutUser().catch(error => {
        alert(`Erro ao fazer logout: ${error.message}`);
    });
});

// ADIÇÃO: Event listener para a submissão do formulário de nova transação
addTransactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) {
        alert("Você precisa estar logado para adicionar uma transação.");
        return;
    }

    // Captura os valores do formulário
    const description = transactionDescriptionInput.value;
    const amount = parseFloat(transactionAmountInput.value);
    const type = document.querySelector('input[name="transaction-type"]:checked').value;

    const transactionData = {
        description,
        amount,
        type,
        userId: currentUser.uid // Associa a transação ao usuário logado
    };

    try {
        await addTransaction(transactionData);
        alert("Transação adicionada com sucesso!");
        addTransactionForm.reset();
        // Futuramente, aqui chamaremos a função para recarregar a lista de transações na tela.
    } catch (error) {
        alert(`Erro ao adicionar transação: ${error.message}`);
    }
});


// --- Ponto de Entrada da Aplicação ---

/**
 * Função principal que inicializa o monitoramento de estado de autenticação.
 */
function initializeApp() {
    showLoading();
    monitorAuthState((user) => {
        if (user) {
            currentUser = user; // ATUALIZAÇÃO: Armazena os dados do usuário
            showApp();
            // Futuramente, aqui chamaremos a função para carregar as transações do usuário.
        } else {
            currentUser = null; // ATUALIZAÇÃO: Limpa os dados do usuário ao deslogar
            showAuthForms();
            toggleAuthForms(false);
        }
    });
}

// Inicia a aplicação.
initializeApp();
