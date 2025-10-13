// Importa as funções de autenticação e o monitor de estado do nosso módulo auth.
import { registerUser, loginUser, logoutUser, monitorAuthState } from './modules/auth.js';

// --- Seleção de Elementos do DOM ---
// Contêineres principais
const loadingDiv = document.getElementById('loading');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');

// Seções de formulário
const loginSection = document.getElementById('login-form');
const registerSection = document.getElementById('register-form');

// Formulários
const loginForm = loginSection.querySelector('form');
const registerForm = registerSection.querySelector('form');

// Inputs
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');

// Links e Botões
const showRegisterLink = document.getElementById('show-register-link');
const showLoginLink = document.getElementById('show-login-link');
const logoutButton = document.getElementById('logout-button');

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

// --- Lógica de Autenticação e Eventos ---

// Event listener para o link "Cadastre-se"
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault(); // Impede que o link recarregue a página
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
        // Não precisamos fazer nada aqui, o monitorAuthState cuidará de mostrar o app
        loginForm.reset();
    } catch (error) {
        // Em um app real, mostraríamos isso em um elemento de UI, não em um alert.
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
        // O monitorAuthState cuidará de mostrar o app
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

// --- Ponto de Entrada da Aplicação ---

/**
 * Função principal que inicializa o monitoramento de estado de autenticação.
 * Esta é a primeira coisa que executa e define qual tela o usuário verá.
 */
function initializeApp() {
    showLoading();
    monitorAuthState((user) => {
        if (user) {
            showApp();
        } else {
            showAuthForms();
            toggleAuthForms(false); // Garante que o form de login seja o padrão
        }
    });
}

// Inicia a aplicação.
initializeApp();
