// Importa as funções de autenticação e o monitor de estado do nosso módulo auth.
import { registerUser, loginUser, logoutUser, monitorAuthState } from './modules/auth.js';
// ALTERAÇÃO: Importa as funções do novo módulo 'transactions.js'.
import { addTransaction, getTransactions, deleteTransaction, updateTransaction } from './modules/transactions.js';

// --- Variável de Estado ---
let currentUser = null;

// --- Seleção de Elementos do DOM ---
// Contêineres principais e de autenticação
const loadingDiv = document.getElementById('loading');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginSection = document.getElementById('login-form');
const registerSection = document.getElementById('register-form');
const loginForm = loginSection.querySelector('form');
const registerForm = registerSection.querySelector('form');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');
const showRegisterLink = document.getElementById('show-register-link');
const showLoginLink = document.getElementById('show-login-link');
const logoutButton = document.getElementById('logout-button');

// Elementos do formulário de transação
const addTransactionForm = document.getElementById('add-transaction-form');
const transactionDescriptionInput = document.getElementById('transaction-description');
const transactionAmountInput = document.getElementById('transaction-amount');

// Elementos do Dashboard
const totalRevenueEl = document.getElementById('total-revenue');
const totalExpensesEl = document.getElementById('total-expenses');
const finalBalanceEl = document.getElementById('final-balance');
const transactionsListEl = document.getElementById('transactions-list');

// Contêiner de notificações e Modal
const notificationContainer = document.getElementById('notification-container');
const editModal = document.getElementById('edit-modal');
const closeButton = document.querySelector('.close-button');
const editTransactionForm = document.getElementById('edit-transaction-form');
const editTransactionIdInput = document.getElementById('edit-transaction-id');
const editTransactionDescriptionInput = document.getElementById('edit-transaction-description');
const editTransactionAmountInput = document.getElementById('edit-transaction-amount');


// --- Funções de Manipulação da UI ---

/**
 * Exibe uma notificação "toast" na tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - O tipo de notificação ('success' ou 'error').
 */
function showNotification(message, type = 'success') {
    const toast = document.createElement('div');
    toast.classList.add('toast', type);
    toast.textContent = message;
    notificationContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

/** Abre e preenche o modal de edição com os dados da transação. */
function openEditModal(transaction) {
    editTransactionIdInput.value = transaction.id;
    editTransactionDescriptionInput.value = transaction.description;
    editTransactionAmountInput.value = transaction.amount;
    // Marca o radio button correspondente ao tipo
    document.querySelector(`input[name="edit-transaction-type"][value="${transaction.type}"]`).checked = true;
    editModal.style.display = 'flex';
}

/** Fecha o modal de edição. */
function closeEditModal() {
    editModal.style.display = 'none';
}

/** Formata um número para o padrão de moeda BRL. */
function formatCurrency(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Renderiza o dashboard: calcula totais e exibe a lista de transações. */
function updateDashboard(transactions) {
    let totalRevenue = 0;
    let totalExpenses = 0;
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

            const li = document.createElement('li');
            li.classList.add(transaction.type);
            
            const transactionInfo = document.createElement('div');
            const descriptionSpan = document.createElement('span');
            descriptionSpan.className = 'transaction-description';
            descriptionSpan.textContent = transaction.description;
            const amountSpan = document.createElement('span');
            amountSpan.className = 'transaction-amount';
            amountSpan.textContent = formatCurrency(transaction.amount);
            transactionInfo.appendChild(descriptionSpan);
            transactionInfo.appendChild(amountSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'transaction-actions';

            const editButton = document.createElement('button');
            editButton.innerHTML = '&#9998;'; // Código HTML para lápis
            editButton.classList.add('action-btn', 'edit-btn');
            editButton.onclick = () => openEditModal(transaction);
            
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '&times;'; // Código HTML para 'X'
            deleteButton.classList.add('action-btn', 'delete-btn');
            deleteButton.onclick = async () => {
                if (confirm(`Tem certeza que deseja excluir a transação "${transaction.description}"?`)) {
                    try {
                        await deleteTransaction(transaction.id);
                        showNotification('Transação excluída com sucesso!');
                        loadUserDashboard();
                    } catch (error) {
                        showNotification(error.message, 'error');
                    }
                }
            };

            actionsDiv.appendChild(editButton);
            actionsDiv.appendChild(deleteButton);
            li.appendChild(transactionInfo);
            li.appendChild(actionsDiv);
            transactionsListEl.appendChild(li);
        });
    }

    const finalBalance = totalRevenue - totalExpenses;
    totalRevenueEl.textContent = formatCurrency(totalRevenue);
    totalExpensesEl.textContent = formatCurrency(totalExpenses);
    finalBalanceEl.textContent = formatCurrency(finalBalance);
}

/** Busca os dados do usuário e chama a função para atualizar o dashboard. */
async function loadUserDashboard() {
    if (!currentUser) return;
    transactionsListEl.innerHTML = '<li>Carregando transações...</li>';
    try {
        const transactions = await getTransactions(currentUser.uid);
        updateDashboard(transactions);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function showLoading() { loadingDiv.style.display = 'block'; authContainer.style.display = 'none'; appContainer.style.display = 'none'; }
function showAuthForms() { loadingDiv.style.display = 'none'; authContainer.style.display = 'block'; appContainer.style.display = 'none'; }
function showApp() { loadingDiv.style.display = 'none'; authContainer.style.display = 'none'; appContainer.style.display = 'block'; }
function toggleAuthForms(showRegister) { if (showRegister) { loginSection.style.display = 'none'; registerSection.style.display = 'block'; } else { loginSection.style.display = 'block'; registerSection.style.display = 'none'; } }

// --- Lógica de Negócios e Eventos ---

showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(true); });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(false); });
logoutButton.addEventListener('click', () => { logoutUser().catch(error => showNotification(error.message, 'error')); });
closeButton.addEventListener('click', closeEditModal);
window.addEventListener('click', (event) => { if (event.target == editModal) { closeEditModal(); } });

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await loginUser(loginEmailInput.value, loginPasswordInput.value);
        loginForm.reset();
    } catch (error) {
        showNotification(error.message, 'error');
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await registerUser(registerEmailInput.value, registerPasswordInput.value);
        registerForm.reset();
    } catch (error) {
        showNotification(error.message, 'error');
    }
});

addTransactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) { showNotification("Você precisa estar logado.", 'error'); return; }
    const transactionData = {
        description: transactionDescriptionInput.value,
        amount: parseFloat(transactionAmountInput.value),
        type: document.querySelector('input[name="transaction-type"]:checked').value,
        userId: currentUser.uid
    };
    try {
        await addTransaction(transactionData);
        showNotification("Transação adicionada com sucesso!");
        addTransactionForm.reset();
        loadUserDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    }
});

editTransactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const transactionId = editTransactionIdInput.value;
    const updatedData = {
        description: editTransactionDescriptionInput.value,
        amount: parseFloat(editTransactionAmountInput.value),
        type: document.querySelector('input[name="edit-transaction-type"]:checked').value,
    };
    try {
        await updateTransaction(transactionId, updatedData);
        showNotification('Transação atualizada com sucesso!');
        closeEditModal();
        loadUserDashboard();
    } catch (error) {
        showNotification(error.message, 'error');
    }
});


// --- Ponto de Entrada da Aplicação ---
function initializeApp() {
    showLoading();
    monitorAuthState((user) => {
        if (user) {
            currentUser = user;
            showApp();
            loadUserDashboard();
        } else {
            currentUser = null;
            showAuthForms();
            toggleAuthForms(false);
        }
    });
}

initializeApp();
