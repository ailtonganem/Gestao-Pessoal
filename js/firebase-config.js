// Importa as funções necessárias do SDK do Firebase que vamos usar.
// Estamos usando os URLs do CDN oficial do Firebase para importar como módulos ES6.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// SUBSTITUA TODO O BLOCO ABAIXO PELO CÓDIGO QUE VOCÊ COPIOU DO CONSOLE DO FIREBASE.
// O seu código terá valores reais no lugar de "COLE_SUA_API_KEY_AQUI", etc.
const firebaseConfig = {
  apiKey: "AIzaSyBqFoSqX-DQKkp8ovKcnQaXvFyXGXm5c74",
  authDomain: "gestao-pessoal-27a6e.firebaseapp.com",
  projectId: "gestao-pessoal-27a6e",
  storageBucket: "gestao-pessoal-27a6e.firebasestorage.app",
  messagingSenderId: "541609699147",
  appId: "1:541609699147:web:c0dbaf8862e2c0c4796ace"
};

// --- INÍCIO DA ALTERAÇÃO ---
// Adicione seu token da Brapi API aqui.
// Você pode obter um token gratuito em https://brapi.dev/
// IMPORTANTE: Adicione este arquivo (firebase-config.js) ao seu .gitignore para não expor suas chaves!
const brapiApiToken = "COLE_SEU_TOKEN_DA_BRAPI_API_AQUI";
// --- FIM DA ALTERAÇÃO ---


// Inicializa o Firebase com as configurações fornecidas.
const app = initializeApp(firebaseConfig);

// Inicializa o serviço de Autenticação do Firebase e o torna disponível para uso.
const auth = getAuth(app);

// Inicializa o serviço do Cloud Firestore e o torna disponível para uso.
const db = getFirestore(app);

// Exporta as instâncias dos serviços que serão usados em outros módulos da aplicação.
export { auth, db, brapiApiToken };
