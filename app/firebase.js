// 1. 引入 Firebase 和 Firestore 資料庫功能
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 2. 你的專屬連線密碼 (我幫你填好了)
const firebaseConfig = {
  apiKey: "AIzaSyDpdGDHsrzkr1bbOSBteDFHvqD6qAiRzig",
  authDomain: "my-travel-app-6fc6c.firebaseapp.com",
  projectId: "my-travel-app-6fc6c",
  storageBucket: "my-travel-app-6fc6c.firebasestorage.app",
  messagingSenderId: "878311392552",
  appId: "1:878311392552:web:6b58f8e364f10dcff7bc1d",
  measurementId: "G-1KW7PWEF3B"
};

// 3. 啟動 Firebase 並匯出資料庫
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };