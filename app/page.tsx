"use client";
import { useState, useEffect } from "react";
import { db } from "./firebase"; 
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";

// 定義行程資料型別
interface Plan {
  id: string;
  title: string;
  date: string;
  note: string;
}

export default function Home() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  
  // ✅ 修正你之前的型別錯誤
  const [tripId, setTripId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      let currentId = searchParams.get("tripId");

      if (!currentId) {
        currentId = Math.random().toString(36).substring(2, 10);
        const newUrl = `${window.location.pathname}?tripId=${currentId}`;
        window.history.replaceState(null, "", newUrl);
      }
      setTripId(currentId);

      const q = query(
        collection(db, "trips", currentId, "plans"), 
        orderBy("date", "asc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Plan[];
        setPlans(list);
      });

      return () => unsubscribe();
    }
  }, []);

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
      setTitle(""); setDate(""); setNote("");
    } catch (error) {
      alert("新增失敗");
    }
  }

  async function handleDelete(planId: string) {
    if (!tripId) return;
    if (confirm("確定要刪除這個行程嗎？")) {
      await deleteDoc(doc(db, "trips", tripId, "plans", planId));
    }
  }

  function copyLink() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      alert("🔗 連結已複製！");
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <h1>✈️ 旅遊行程表 (共享版)</h1>
        <button onClick={copyLink} style={{ padding: "8px 16px", borderRadius: "20px", border: "1px solid #0070f3", color: "#0070f3", background: "white", cursor: "pointer" }}>
          🔗 複製分享連結
        </button>
      </div>

      <div style={{ backgroundColor: "#f0f9ff", padding: "20px", borderRadius: "12px", marginBottom: "30px" }}>
        <input type="text" placeholder="地點" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
        <input 
  type="date" 
  value={date} 
  onChange={(e) => setDate(e.target.value)} 
  style={{ 
    width: "100%", 
    padding: "12px", 
    marginBottom: "10px", 
    borderRadius: "8px", 
    border: "1px solid #ddd",
    fontSize: "16px",        // 防止 iPhone 自動放大頁面
    backgroundColor: "white", // 確保背景不是透明
    color: "#333",           // 確保文字顏色清晰
    minHeight: "45px",       // 讓點擊區域夠大
    display: "block",
    appearance: "none",      // 去除某些瀏覽器預設樣式
    WebkitAppearance: "none"
  }} 
/>
        <textarea placeholder="備註" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
        <button onClick={handleAdd} style={{ width: "100%", padding: "12px", backgroundColor: "#0070f3", color: "white", borderRadius: "8px" }}>➕ 加入行程</button>
      </div>

      <div>
        {plans.map((plan: Plan) => (
          <div key={plan.id} style={{ border: "1px solid #ddd", borderRadius: "12px", padding: "16px", marginBottom: "12px", backgroundColor: "#fff" }}>
            <h3>{plan.title}</h3>
            <p>📅 {plan.date || "未定日期"}</p>
            <p>💡 {plan.note}</p>
            <div style={{ display: "flex", gap: "10px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.title)}`} target="_blank" rel="noreferrer" style={{ color: "#0070f3", textDecoration: "none" }}>🗺️ 查看地圖</a>
              <button onClick={() => handleDelete(plan.id)} style={{ marginLeft: "auto", color: "#ff4d4f", background: "none", border: "none", cursor: "pointer" }}>🗑️ 刪除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}