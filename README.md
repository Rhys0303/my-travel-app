# 🌍 旅遊總管 (Travel Planner Hub)

一個基於 React、Next.js (App Router) 與 Firebase Realtime Firestore 打造的**極簡、高效能多人即時協作旅遊規劃 PWA Web App**。

本專案核心專注於解決行動端網頁（Mobile Web）不支援 HTML5 Drag and Drop API 的痛點，並結合 **去中心化（Decentralized Storage）** 的本地清單管理與雲端即時同步技術。

---

## 🚀 核心功能與亮點

### 1. 🤝 多人即時協作與智慧分流
* **單一連結邀請**：透過產生帶有群組特徵（`groupId`）的協作網址，朋友點擊即可開啟相同頁面。
* **智慧列表分流**：
  * 使用者自行點擊「建立新旅程」產生的項目，將永久歸類於 **「🏠 我建立的行程」**。
  * 點開朋友分享的連結，系統會進行解構判定，自動將其歸類於首頁的 **「🤝 朋友分享的行程」**。

### 2. 📱 行動端觸控拖曳排序 (Mobile Touch Reordering)
* 針對 iOS/Android 瀏覽器不支援 `draggable` 屬性的原生缺陷，自行透過 React `useRef` 與 **Touch Events (`onTouchStart`, `onTouchMove`, `onTouchEnd`)** 實作了一套**碰撞偵測演算法**。
* 透過 `document.elementFromPoint(x, y)` 動態比對網頁座標，在手指滑動時即時進行微型 UI 陣列排序，並在手指放開後**批次寫入（Firestore WriteBatch）** 雲端，兼顧效能與操作手感。
* 容器設定 `touch-action: none` 防止系統預設的下拉重整攔截拖曳行為。

### 3. 💾 強效資料同步與防丟失機制 (Race Condition Fix)
* **狀態競爭處理**：在多人同時對一趟旅程進行天數（Day ID）與行程切換時，`useEffect` 會強制解構並清除舊的監聽器（Cleanup Subscription），即時與雲端重新建立精確連線，防止資料寫入錯誤路徑。
* **防呆安全鎖**：新增行程前會自動校驗 `tripId` 的有效性，避免因為網路延遲將數據存入「虛無」中。
* ![Uploading 7a0c0e15cac7820acc7fcdce99aee21f.jpeg…]()

* **雙向名稱同步**：不論在行程內或首頁大廳更名，變更將同時推播至雲端及本地 `LocalStorage`快取，確保所有協作人員介面一致。

### 4. 📝 精確的大廳與內部編輯模式
* 首頁旅程名稱採用**非即時觸發的獨立編輯按鈕「📝」設計**，避免滑動時誤觸。
* 行程內部（卡片備註）支援 **網址自動偵測**，會透過 Regex 自動篩選出連結並轉化為帶有 `target="_blank"` 的可點擊超連結，並一鍵對接 Google Maps API 提供實時地圖查詢。

---

## 🛠️ 技術棧 (Tech Stack)

* **Framework**: Next.js 14+ (React 18+, TypeScript)
* **Styling**: Tailwind CSS / Inline CSS (Flexbox & Grid 響應式佈局)
* **Database**: Firebase Firestore (Real-time `onSnapshot` 異步數據串流)
* **State Management**: React Hooks (`useState`, `useEffect`, `useRef`)
* **Storage**: LocalStorage API (快取與自建/分享清單分流持久化)

---

## 📂 系統架構與資料流 (Data Flow)
### Firestore 資料庫設計
* **`groups/{groupId}`**: 儲存旅程名稱及天數陣列（如：`[{id: "day_1", label: "Day 1"}]`）。
* **`trips/{dayId}/plans/{planId}`**: 儲存特定天數下的具體行程（地點、備註、`order` 排序欄位）。

---

## ⚙️ 本地開發環境設置 (Getting Started)

### 1. 複製專案
```bash
git clone <your-repo-url>
cd <your-repo-name>

2. 安裝依賴
npm install

3. 啟動開發伺服器

npm run dev

打開 http://localhost:3000 即可在本地瀏覽。
