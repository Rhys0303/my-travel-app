"use client";
import { useState, useEffect } from "react";
import { db } from "./firebase"; 
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";

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
  const [tripId, setTripId] = useState<string | null>(null);
  const [activeTrips, setActiveTrips] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTrips = JSON.parse(localStorage.getItem("activeTrips") || "[]");
      const searchParams = new URLSearchParams(window.location.search);
      let currentId = searchParams.get("tripId");

      if (!currentId) {
        currentId = Math.random().toString(36).substring(2, 10);
      }

      const updatedTrips = Array.from(new Set([...savedTrips, currentId]));
      setActiveTrips(updatedTrips);
      localStorage.setItem("activeTrips", JSON.stringify(updatedTrips));
      
      setTripId(currentId);
      const newUrl = `${window.location.pathname}?tripId=${currentId}`;
      window.history.replaceState(null, "", newUrl);
    }
  }, []);

  useEffect(() => {
    if (!tripId) return;
    const q = query(collection(db, "trips", tripId, "plans"), orderBy("date", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Plan[];
      setPlans(list);
    });
    return () => unsubscribe();
  }, [tripId]);

  const switchTrip = (id: string) => {
    setTripId(id);
    const newUrl = `${window.location.pathname}?tripId=${id}`;
    window.history.replaceState(null, "", newUrl);
  };

  const createNewTrip = () => {
    const newId = Math.random().toString(36).substring(2, 10);
    const updated = [...activeTrips, newId];
    setActiveTrips(updated);
    localStorage.setItem("activeTrips", JSON.stringify(updated));
    switchTrip(newId);
  };

  const closeTrip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = activeTrips.filter(t => t !== id);
    setActiveTrips(updated);
    localStorage.setItem("activeTrips", JSON.stringify(updated));
    if (tripId === id && updated.length > 0) switchTrip(updated[0]);
    else if (updated.length === 0) createNewTrip();
  };

  async function handleAdd() {
    if (!title || !tripId) return alert("請輸入地點！");
    try {
      await addDoc(collection(db, "trips", tripId, "plans"), {
        title, date, note, createdAt: new Date()
      });
      setTitle(""); setDate(""); setNote("");
    } catch (e) { alert("新增失敗"); }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      
      {/* 分頁 UI */}
      <div style={{ display: "flex", gap: "5px", overflowX: "auto", marginBottom: "20px", paddingBottom: "10px" }}>
        {activeTrips.map((id) => (
          <div 
            key={id} 
            onClick={() => switchTrip(id)}
            style={{
              padding: "8px 15px", borderRadius: "10px 10px 0 0", cursor: "pointer", whiteSpace: "nowrap",
              backgroundColor: tripId === id ? "#0070f3" : "#eee",
              color: tripId === id ? "white" : "#666",
              display: "flex", alignItems: "center", gap: "8px", border: "1px solid #ddd"
            }}
          >
            旅程 {id.substring(0, 4)}
            <span onClick={(e) => closeTrip(id, e)} style={{ fontSize: "12px", opacity: 0.7 }}>✕</span>
          </div>
        ))}
        <button onClick={createNewTrip} style={{ padding: "8px 15px", borderRadius: "10px", border: "1px dashed #999", background: "none", cursor: "pointer" }}>
          ＋ 新增
        </button>
      </div>

      <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert("連結已複製"); }} 
              style={{ width: "100%", padding: "12px", marginBottom: "20px", borderRadius: "20px", border: "1px solid #0070f3", color: "#0070f3", background: "white", cursor: "pointer", fontWeight: "bold" }}>
        🔗 複製目前旅程分享連結
      </button>

      {/* 輸入區 */}
      <div style={{ backgroundColor: "#f0f9ff", padding: "20px", borderRadius: "12px", marginBottom: "30px", border: "1px solid #d1e9ff" }}>
        <input placeholder="地點 (例如：東京鐵塔)" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} 
               style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "16px", backgroundColor: "white", color: "#333", minHeight: "45px" }} />
        <textarea placeholder="備註 (必吃、交通資訊...)" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd", minHeight: "60px" }} />
        <button onClick={handleAdd} style={{ width: "100%", padding: "12px", backgroundColor: "#0070f3", color: "white", borderRadius: "8px", border: "none", fontWeight: "bold", fontSize: "16px", cursor: "pointer" }}>➕ 加入行程</button>
      </div>

      {/* 列表區 */}
      <div>
        {plans.map((plan) => (
          <div key={plan.id} style={{ border: "1px solid #eee", borderRadius: "12px", padding: "16px", marginBottom: "12px", backgroundColor: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <h3 style={{ margin: "0 0 5px 0", color: "#333" }}>{plan.title}</h3>
            <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}>📅 {plan.date || "未定日期"}</p>
            {plan.note && <p style={{ margin: "0 0 12px 0", fontSize: "15px", color: "#444", whiteSpace: "pre-wrap" }}>💡 {plan.note}</p>}
            
            <div style={{ display: "flex", gap: "15px", borderTop: "1px solid #eee", paddingTop: "12px" }}>
              {/* ✨ 加回來的地圖連結 */}
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.title)}`} 
                target="_blank" 
                rel="noreferrer" 
                style={{ color: "#0070f3", textDecoration: "none", fontSize: "14px", fontWeight: "bold", display: "flex", alignItems: "center" }}
              >
                🗺️ 查看地圖
              </a>
              
              <button 
                onClick={() => { if(confirm("確定刪除此行程？")) deleteDoc(doc(db, "trips", tripId!, "plans", plan.id)) }} 
                style={{ marginLeft: "auto", color: "#ff4d4f", background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}
              >
                🗑️ 刪除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}