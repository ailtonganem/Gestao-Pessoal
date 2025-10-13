// Importa as funções necessárias do SDK do Firebase que vamos usar.
// Estamos usando os URLs do CDN oficial do Firebase para importar como módulos ES6.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
// ADIÇÃO: Importa o serviço do Firestore.
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Objeto de configuração do seu aplicativo web do Firebase.
// SUBSTITUA OS VALORES ABAIXO PELOS DADOS DO SEU PROJETO.
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializa o Firebase com as configurações fornecidas.
const app = initializeApp(firebaseConfig);

// Inicializa o serviço de Autenticação do Firebase e o torna disponível para uso.
const auth = getAuth(app);

// ADIÇÃO: Inicializa o serviço do Cloud Firestore e o torna disponível para uso.
const db = getFirestore(app);

// Exporta as instâncias dos serviços que serão usados em outros módulos da aplicação.
// ATUALIZAÇÃO: Exporta também a instância do 'db'.
export { auth, db };
