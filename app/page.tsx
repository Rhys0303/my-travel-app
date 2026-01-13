"use client";
import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";

export default function Home() {
  const [plans, setPlans] = useState([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  // 抓資料
  async function fetchData() {
    const querySnapshot = await getDocs(collection(db, "plans"));
    const list = [];
    querySnapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    // 依照日期排序
    list.sort((a, b) => (a.date > b.date ? 1 : -1));
    setPlans(list);
  }

  useEffect(() => {
    fetchData();
  }, []);

  // 新增資料
  async function handleAdd() {
    if (!title) return alert("請輸入地點！");
    try {
      await addDoc(collection(db, "plans"), {
        title,
        date,
        note
      });
      setTitle("");
      setDate("");
      setNote("");
      fetchData();
    } catch (error) {
      alert("新增失敗");
    }
  }

  // 刪除資料 (新增的功能)
  async function handleDelete(id) {
    if (confirm("確定要刪除這個行程嗎？")) {
      await deleteDoc(doc(db, "plans", id));
      fetchData();
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center", marginBottom: "30px" }}>✈️ 旅遊行程表 (共享版)</h1>

      {/* 輸入區 */}
      <div style={{ backgroundColor: "#f0f9ff", padding: "20px", borderRadius: "12px", marginBottom: "30px" }}>
        <input 
          type="text" 
          placeholder="地點 (例如：晴空塔)" 
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
        <button onClick={handleAdd} style={{ width: "100%", padding: "12px", backgroundColor: "#0070f3", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold" }}>
          ➕ 加入行程
        </button>
      </div>

      {/* 列表區 */}
      <div>
        {plans.map((plan) => (
          <div key={plan.id} style={{
            border: "1px solid #ddd", borderRadius: "12px", padding: "16px", marginBottom: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", backgroundColor: "#fff", position: "relative"
          }}>
            {/* 標題與日期 */}
            <h2 style={{ fontSize: "18px", margin: "0 0 5px 0", color: "#333" }}>{plan.title}</h2>
            <div style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>📅 {plan.date || "未定日期"}</div>
            
            {/* 備註 */}
            <p style={{ margin: "0 0 10px 0", color: "#444", fontSize: "15px" }}>💡 {plan.note}</p>

            {/* 按鈕區：Google Map + 刪除 */}
            <div style={{ display: "flex", gap: "10px", marginTop: "10px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
              
              {/* 👇 這裡就是自動產生的 Google Maps 按鈕 */}
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${plan.title}`} 
                target="_blank"
                style={{ textDecoration: "none", color: "#0070f3", fontSize: "14px", fontWeight: "bold", display: "flex", alignItems: "center" }}
              >
                🗺️ 在地圖查看
              </a>

              {/* 刪除按鈕 */}
              <button 
                onClick={() => handleDelete(plan.id)}
                style={{ marginLeft: "auto", backgroundColor: "transparent", border: "none", color: "#ff4d4f", cursor: "pointer", fontSize: "14px" }}
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