export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-4">
      {/* 標題區 */}
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          我們的旅遊行程 ✈️
        </h1>
        <button className="rounded-full bg-blue-600 px-4 py-2 text-white shadow-md hover:bg-blue-700">
          登入
        </button>
      </header>

      {/* 內容區：模擬行程卡片 */}
      <div className="space-y-4">
        {/* 第一天 */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-blue-600">Day 1 - 2026/02/14</h2>
          <div className="border-l-4 border-green-500 pl-3">
            <h3 className="font-bold">淺草雷門</h3>
            <p className="text-sm text-gray-500">10:00 AM - 記得穿和服</p>
            
            {/* Google Maps 跳轉按鈕 */}
            <a 
              href="https://www.google.com/maps/search/?api=1&query=淺草雷門" 
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block rounded-md bg-green-100 px-3 py-1 text-sm text-green-700 hover:bg-green-200"
            >
              在 Google Maps 查看 🗺️
            </a>
          </div>
        </div>

        {/* 測試用：第二天 */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-blue-600">Day 2 - 2026/02/15</h2>
          <div className="border-l-4 border-yellow-500 pl-3">
            <h3 className="font-bold">迪士尼樂園</h3>
            <p className="text-sm text-gray-500">08:00 AM - 提早排隊</p>
             <a 
              href="https://www.google.com/maps/search/?api=1&query=東京迪士尼樂園" 
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block rounded-md bg-green-100 px-3 py-1 text-sm text-green-700 hover:bg-green-200"
            >
              在 Google Maps 查看 🗺️
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}