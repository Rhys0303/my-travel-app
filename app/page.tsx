"use client";
import { useState, useEffect } from "react";
import { db } from "./firebase";
// 這次多引入了 addDoc (新增資料的功能)
import { collection, getDocs, addDoc } from "firebase/firestore";

export default function Home() {
  const [plans, setPlans] = useState([]);
  
  // 1. 這些是用來暫存你輸入框裡的文字
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  // 抓取資料的函式 (跟之前一樣)
  async function fetchData() {
    const querySnapshot = await getDocs(collection(db, "plans"));
    const list = [];
    querySnapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    // 這裡做個簡單排序，讓日期近的排上面
    list.sort((a, b) => (a.date > b.date ? 1 : -1));
    setPlans(list);
  }

  useEffect(() => {
    fetchData();
  }, []);

  // 2. 這就是「新增行程」的神奇按鈕功能
  async function handleAdd() {
    if (!title) return alert("請至少輸入行程名稱喔！");

    try {
      // 把資料寫入 Firebase 雲端
      await addDoc(collection(db, "plans"), {
        title: title,
        date: date,
        note: note
      });

      // 清空輸入框
      setTitle("");
      setDate("");
      setNote("");
      
      // 重新抓取資料，讓畫面馬上更新
      fetchData();
    } catch (error) {
      console.error("新增失敗：", error);
      alert("發生錯誤，請檢查主控台");
    }
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center", marginBottom: "30px" }}>✈️ 我們的旅遊計畫</h1>

      {/* 輸入區塊 */}
      <div style={{ backgroundColor: "#f0f9ff", padding: "20px", borderRadius: "12px", marginBottom: "30px" }}>
        <h3 style={{ margin: "0 0 15px 0", color: "#0070f3" }}>新增一個行程</h3>
        <input 
          type="text" 
          placeholder="要去哪裡？(例如：迪士尼)" 
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
          placeholder="備註 (例如：記得買門票)" 
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
        />
        <button 
          onClick={handleAdd}
          style={{ width: "100%", padding: "12px", backgroundColor: "#0070f3", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
        >
          ➕ 加入行程
        </button>
      </div>

      {/* 顯示列表區塊 */}
      <div>
        {plans.map((plan) => (
          <div key={plan.id} style={{
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            backgroundColor: "#fff"
          }}>
            <h2 style={{ fontSize: "18px", margin: "0 0 8px 0", color: "#333" }}>
              {plan.title}
            </h2>
            <div style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>
              📅 {plan.date || "未定日期"}
            </div>
            <p style={{ margin: "0", color: "#444", fontSize: "15px", borderTop: "1px solid #eee", paddingTop: "8px" }}>
              💡 {plan.note}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}