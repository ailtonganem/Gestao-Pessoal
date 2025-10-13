// Este módulo gerencia as categorias de transações.
// Por enquanto, as categorias são pré-definidas no código (hardcoded).
// No futuro, este módulo pode ser expandido para buscar e salvar
// categorias personalizadas do usuário no Firestore.

const defaultCategories = {
    revenue: [
        'Salário',
        'Vendas',
        'Investimentos',
        'Freelance',
        'Presente'
    ],
    expense: [
        'Alimentação',
        'Moradia',
        'Transporte',
        'Saúde',
        'Educação',
        'Lazer',
        'Impostos',
        'Vestuário',
        'Supermercado'
    ]
};

/**
 * Retorna uma lista de categorias padrão com base no tipo de transação.
 * @param {string} type - O tipo de transação ('revenue' ou 'expense').
 * @returns {Array<string>} Uma lista de nomes de categorias.
 */
function getCategories(type) {
    if (type === 'revenue' || type === 'expense') {
        return defaultCategories[type];
    }
    // Retorna um array vazio se o tipo for inválido
    return [];
}

// Exporta a função para ser utilizada em outros módulos.
export { getCategories };
