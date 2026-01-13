"use client";
import { useState, useEffect } from "react";
// ⚠️ 請確認你的 firebase.js 檔案路徑正確，如果是在同一層目錄就不用改
import { db } from "./firebase"; 
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";

export default function Home() {
  const [plans, setPlans] = useState([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  
  // 記錄目前的行程群組 ID
  const [tripId, setTripId] = useState(null);

  // 初始化：處理網址 ID & 啟動監聽
  useEffect(() => {
    // 1. 抓取網址上的 ID
    const searchParams = new URLSearchParams(window.location.search);
    let currentId = searchParams.get("tripId");

    // 2. 如果網址沒有 ID，就隨機產生一個，並更新網址 (不換頁)
    if (!currentId) {
      currentId = Math.random().toString(36).substring(2, 10);
      const newUrl = `${window.location.pathname}?tripId=${currentId}`;
      window.history.replaceState(null, "", newUrl);
    }
    setTripId(currentId);

    // 3. 啟動 Firebase 即時監聽
    // 資料結構： trips -> {tripId} -> plans -> {planId}
    const q = query(
      collection(db, "trips", currentId, "plans"), 
      orderBy("date", "asc") // 依照日期排序
    );

    // onSnapshot 會建立長連線，資料庫一變動，這裡就會自動執行
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPlans(list);
    });

    // 當離開頁面時，取消監聽
    return () => unsubscribe();

  }, []);

  // 新增資料
  async function handleAdd() {
    if (!title) return alert("請輸入地點！");
    if (!tripId) return;

    try {
      await addDoc(collection(db, "trips", tripId, "plans"), {
        title,
        date,
        note,
        createdAt: new Date()
      });
      // 清空輸入框
      setTitle("");
      setDate("");
      setNote("");
    } catch (error) {
      console.error(error);
      alert("新增失敗");
    }
  }

  // 刪除資料
  async function handleDelete(planId) {
    if (!tripId) return;
    if (confirm("確定要刪除這個行程嗎？")) {
      await deleteDoc(doc(db, "trips", tripId, "plans", planId));
    }
  }

  // 複製分享連結
  function copyLink() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      alert("🔗 連結已複製！傳給朋友就可以一起編輯囉！");
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      
      {/* 標題與分享按鈕 */}
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <h1>✈️ 旅遊行程表 (共享版)</h1>
        <button 
          onClick={copyLink}
          style={{ padding: "8px 16px", borderRadius: "20px", border: "1px solid #0070f3", color: "#0070f3", background: "white", cursor: "pointer" }}
        >
          🔗 複製分享連結
        </button>
      </div>

      {/* 輸入區 */}
      <div style={{ backgroundColor: "#f0f9ff", padding: "20px", borderRadius: "12px", marginBottom: "30px" }}>
        <input 
          type="text" 
          placeholder="地點 " 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
        />
        <input 
          type="date" 
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
        />
        <input 
          type="text" 
          placeholder="備註" 
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
        />
        <button onClick={handleAdd} style={{ width: "100%", padding: "12px", backgroundColor: "#0070f3", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
          ➕ 加入行程
        </button>
      </div>

      {/* 列表區 */}
      <div>
        {plans.map((plan) => (
          <div key={plan.id} style={{
            border: "1px solid #ddd", borderRadius: "12px", padding: "16px", marginBottom: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", backgroundColor: "#fff", position: "relative"
          }}>
            <h2 style={{ fontSize: "18px", margin: "0 0 5px 0", color: "#333" }}>{plan.title}</h2>
            <div style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>📅 {plan.date || "未定日期"}</div>
            
            <p style={{ margin: "0 0 10px 0", color: "#444", fontSize: "15px" }}>💡 {plan.note}</p>

            <div style={{ display: "flex", gap: "10px", marginTop: "10px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
              
              {/* 地圖按鈕：使用 Google Maps Search API */}
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.title)}`} 
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "none", color: "#0070f3", fontSize: "14px", fontWeight: "bold", display: "flex", alignItems: "center" }}
              >
                🗺️ 在地圖查看
              </a>

              <button 
                onClick={() => handleDelete(plan.id)}
                style={{ marginLeft: "auto", backgroundColor: "transparent", border: "none", color: "#ff4d4f", cursor: "pointer", fontSize: "14px" }}
              >
                🗑️ 刪除
              </button>
            </div>
          </div>
        ))}
        
        {plans.length === 0 && (
          <div style={{ textAlign: "center", color: "#888", marginTop: "20px" }}>
            還沒有行程，快點新增或把連結傳給朋友吧！👆
          </div>
        )}
      </div>
    </div>
  );
}