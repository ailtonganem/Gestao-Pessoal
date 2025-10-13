// Importa as funções de autenticação.
import { registerUser, loginUser, logoutUser, monitorAuthState } from './modules/auth.js';
// Importa as funções de transações.
import { addTransaction, getTransactions, deleteTransaction, updateTransaction } from './modules/transactions.js';
// Importa a função de categorias.
import { getCategories } from './modules/categories.js';
// Importa as funções de cartão de crédito.
import { addCreditCard, getCreditCards, deleteCreditCard } from './modules/creditCard.js';

// --- Variável de Estado ---
let currentUser = null;
let userCreditCards = []; // Cache para os cartões do usuário

// --- Seleção de Elementos do DOM ---
// Contêineres principais
const loadingDiv = document.getElementById('loading');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');

// Seções e Formulários de autenticação
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

// Formulário de Adicionar Transação
const addTransactionForm = document.getElementById('add-transaction-form');
const transactionDescriptionInput = document.getElementById('transaction-description');
const transactionAmountInput = document.getElementById('transaction-amount');
const transactionTypeRadios = document.querySelectorAll('input[name="transaction-type"]');
const transactionCategorySelect = document.getElementById('transaction-category');
const newCategoryWrapper = document.getElementById('new-category-wrapper');
const newCategoryInput = document.getElementById('new-transaction-category');
const paymentMethodSelect = document.getElementById('payment-method');
const creditCardWrapper = document.getElementById('credit-card-wrapper');
const creditCardSelect = document.getElementById('credit-card-select');

// Dashboard e Lista
const totalRevenueEl = document.getElementById('total-revenue');
const totalExpensesEl = document.getElementById('total-expenses');
const finalBalanceEl = document.getElementById('final-balance');
const transactionsListEl = document.getElementById('transactions-list');

// Notificações e Modal de Edição
const notificationContainer = document.getElementById('notification-container');
const editModal = document.getElementById('edit-modal');
const closeButton = document.querySelector('.close-button');
const editTransactionForm = document.getElementById('edit-transaction-form');
const editTransactionIdInput = document.getElementById('edit-transaction-id');
const editTransactionDescriptionInput = document.getElementById('edit-transaction-description');
const editTransactionAmountInput = document.getElementById('edit-transaction-amount');
const editTransactionTypeRadios = document.querySelectorAll('input[name="edit-transaction-type"]');
const editTransactionCategorySelect = document.getElementById('edit-transaction-category');
const editPaymentMethodSelect = document.getElementById('edit-payment-method');
const editCreditCardWrapper = document.getElementById('edit-credit-card-wrapper');

// Modal de Cartão de Crédito
const manageCardsButton = document.getElementById('manage-cards-button');
const creditCardModal = document.getElementById('credit-card-modal');
const closeCardModalButton = document.querySelector('.close-card-modal-button');
const creditCardList = document.getElementById('credit-card-list');
const addCreditCardForm = document.getElementById('add-credit-card-form');
const cardNameInput = document.getElementById('card-name');
const cardClosingDayInput = document.getElementById('card-closing-day');
const cardDueDayInput = document.getElementById('card-due-day');


// --- Funções de Manipulação da UI ---

/** Popula um elemento <select> com as categorias apropriadas. */
function populateCategories(type, selectElement, isEditForm = false) {
    const categories = getCategories(type);
    selectElement.innerHTML = ''; // Limpa opções existentes

    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        selectElement.appendChild(option);
    });

    if (!isEditForm) {
        const otherOption = document.createElement('option');
        otherOption.value = 'outra';
        otherOption.textContent = 'Outra...';
        selectElement.appendChild(otherOption);
    }
}

/** Popula os <select> de cartão de crédito com os cartões do usuário. */
function populateCreditCardSelects() {
    creditCardSelect.innerHTML = '';

    if (userCreditCards.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'Nenhum cartão cadastrado';
        option.disabled = true;
        creditCardSelect.appendChild(option);
    } else {
        userCreditCards.forEach(card => {
            const option = document.createElement('option');
            option.value = card.id;
            option.textContent = card.name;
            creditCardSelect.appendChild(option.cloneNode(true));
        });
    }
}

/** Renderiza a lista de cartões no modal de gerenciamento. */
function renderCreditCardList() {
    creditCardList.innerHTML = '';
    if (userCreditCards.length === 0) {
        creditCardList.innerHTML = '<li>Nenhum cartão cadastrado.</li>';
    } else {
        userCreditCards.forEach(card => {
            const li = document.createElement('li');
            li.textContent = `${card.name} (Fecha dia ${card.closingDay}, Vence dia ${card.dueDay})`;
            creditCardList.appendChild(li);
        });
    }
}

/** Exibe uma notificação "toast" na tela. */
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
    document.querySelector(`input[name="edit-transaction-type"][value="${transaction.type}"]`).checked = true;
    
    populateCategories(transaction.type, editTransactionCategorySelect, true);
    editTransactionCategorySelect.value = transaction.category;

    editPaymentMethodSelect.value = transaction.paymentMethod;
    editCreditCardWrapper.style.display = transaction.paymentMethod === 'credit_card' ? 'block' : 'none';

    editModal.style.display = 'flex';
}

/** Fecha o modal de edição. */
function closeEditModal() {
    editModal.style.display = 'none';
}

/** Abre o modal de gerenciamento de cartões. */
function openCardModal() {
    creditCardModal.style.display = 'flex';
}

/** Fecha o modal de gerenciamento de cartões. */
function closeCardModal() {
    creditCardModal.style.display = 'none';
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
            transactionInfo.style.textAlign = 'left';

            const descriptionSpan = document.createElement('span');
            descriptionSpan.className = 'transaction-description';
            descriptionSpan.textContent = transaction.description;
            
            const categorySpan = document.createElement('span');
            categorySpan.style.display = 'block';
            categorySpan.style.fontSize = '0.8rem';
            categorySpan.style.color = '#7f8c8d';
            categorySpan.textContent = `${transaction.category || ''} • ${transaction.paymentMethod || ''}`;
            
            const rightSide = document.createElement('div');
            rightSide.style.display = 'flex';
            rightSide.style.alignItems = 'center';
            rightSide.style.gap = '1rem';
            
            const amountSpan = document.createElement('span');
            amountSpan.className = 'transaction-amount';
            amountSpan.textContent = formatCurrency(transaction.amount);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'transaction-actions';
            
            const editButton = document.createElement('button');
            editButton.innerHTML = '&#9998;';
            editButton.classList.add('action-btn', 'edit-btn');
            editButton.onclick = () => openEditModal(transaction);
            
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '&times;';
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

            transactionInfo.appendChild(descriptionSpan);
            transactionInfo.appendChild(categorySpan);
            actionsDiv.appendChild(editButton);
            actionsDiv.appendChild(deleteButton);
            rightSide.appendChild(amountSpan);
            rightSide.appendChild(actionsDiv);
            li.appendChild(transactionInfo);
            li.appendChild(rightSide);
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

/** Busca os cartões de crédito do usuário e atualiza a UI. */
async function loadUserCreditCards() {
    if (!currentUser) return;
    try {
        userCreditCards = await getCreditCards(currentUser.uid);
        populateCreditCardSelects();
        renderCreditCardList();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function showLoading() { loadingDiv.style.display = 'block'; authContainer.style.display = 'none'; appContainer.style.display = 'none'; }
function showAuthForms() { loadingDiv.style.display = 'none'; authContainer.style.display = 'block'; loginSection.style.display = 'block'; registerSection.style.display = 'none';}
function showApp() { loadingDiv.style.display = 'none'; authContainer.style.display = 'none'; appContainer.style.display = 'block'; }
function toggleAuthForms(showRegister) { if (showRegister) { loginSection.style.display = 'none'; registerSection.style.display = 'block'; } else { loginSection.style.display = 'block'; registerSection.style.display = 'none'; } }

// --- Lógica de Negócios e Eventos ---

showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(true); });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthForms(false); });
logoutButton.addEventListener('click', () => { logoutUser().catch(error => showNotification(error.message, 'error')); });
closeButton.addEventListener('click', closeEditModal);
window.addEventListener('click', (event) => { if (event.target == editModal) { closeEditModal(); } });

manageCardsButton.addEventListener('click', openCardModal);
closeCardModalButton.addEventListener('click', closeCardModal);
window.addEventListener('click', (event) => { if (event.target == creditCardModal) { closeCardModal(); } });

transactionTypeRadios.forEach(radio => { radio.addEventListener('change', (e) => populateCategories(e.target.value, transactionCategorySelect)); });
transactionCategorySelect.addEventListener('change', (e) => { newCategoryWrapper.style.display = e.target.value === 'outra' ? 'block' : 'none'; });
paymentMethodSelect.addEventListener('change', (e) => { creditCardWrapper.style.display = e.target.value === 'credit_card' ? 'block' : 'none'; });
editPaymentMethodSelect.addEventListener('change', (e) => { editCreditCardWrapper.style.display = e.target.value === 'credit_card' ? 'block' : 'none'; });

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
    if (!currentUser) return showNotification("Você precisa estar logado.", 'error');
    
    let category = transactionCategorySelect.value;
    if (category === 'outra') {
        category = newCategoryInput.value.trim();
        if (!category) return showNotification("Por favor, informe o nome da nova categoria.", 'error');
    }

    const transactionData = {
        description: transactionDescriptionInput.value,
        amount: parseFloat(transactionAmountInput.value),
        type: document.querySelector('input[name="transaction-type"]:checked').value,
        category: category,
        paymentMethod: paymentMethodSelect.value,
        userId: currentUser.uid
    };

    try {
        await addTransaction(transactionData);
        showNotification("Transação adicionada com sucesso!");
        addTransactionForm.reset();
        newCategoryWrapper.style.display = 'none';
        creditCardWrapper.style.display = 'none';
        populateCategories('expense', transactionCategorySelect);
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
        category: editTransactionCategorySelect.value,
        paymentMethod: editPaymentMethodSelect.value,
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

addCreditCardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return showNotification("Você precisa estar logado.", 'error');

    const cardData = {
        name: cardNameInput.value,
        closingDay: parseInt(cardClosingDayInput.value),
        dueDay: parseInt(cardDueDayInput.value),
        userId: currentUser.uid
    };

    try {
        await addCreditCard(cardData);
        showNotification("Cartão adicionado com sucesso!");
        addCreditCardForm.reset();
        await loadUserCreditCards();
    } catch (error) {
        showNotification(error.message, 'error');
    }
});

// --- Ponto de Entrada da Aplicação ---
function initializeApp() {
    showLoading();
    monitorAuthState(async (user) => {
        if (user) {
            currentUser = user;
            showApp();
            populateCategories('expense', transactionCategorySelect);
            await Promise.all([
                loadUserDashboard(),
                loadUserCreditCards()
            ]);
        } else {
            currentUser = null;
            userCreditCards = [];
            showAuthForms();
        }
    });
}

initializeApp();
