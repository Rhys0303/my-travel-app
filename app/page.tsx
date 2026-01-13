"use client";
import { useState, useEffect } from "react";
import { db } from "./firebase"; 
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, arrayUnion, getDoc, setDoc } from "firebase/firestore";

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
  
  const [groupId, setGroupId] = useState<string | null>(null); // 群組ID
  const [tripId, setTripId] = useState<string | null>(null);   // 目前選中的分頁ID
  const [activeTrips, setActiveTrips] = useState<string[]>([]); // 該群組內所有的分頁列表

  // 1. 初始化群組與分頁
  useEffect(() => {
    async function initGroup() {
      const searchParams = new URLSearchParams(window.location.search);
      let gId = searchParams.get("groupId");

      // 如果網址沒有 groupId，建立一個新的
      if (!gId) {
        gId = "group_" + Math.random().toString(36).substring(2, 10);
        const firstTripId = Math.random().toString(36).substring(2, 10);
        
        // 在資料庫建立群組文件
        await setDoc(doc(db, "groups", gId), {
          tripIds: [firstTripId]
        });
        
        const newUrl = `${window.location.pathname}?groupId=${gId}`;
        window.history.replaceState(null, "", newUrl);
      }
      setGroupId(gId);

      // 2. 監聽群組動態 (當有人新增分頁時，所有人同步看到新標籤)
      onSnapshot(doc(db, "groups", gId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const ids = data.tripIds || [];
          setActiveTrips(ids);
          // 預設選中第一個分頁
          if (!tripId && ids.length > 0) setTripId(ids[0]);
        }
      });
    }

    if (typeof window !== "undefined") {
      initGroup();
    }
  }, []);

  // 3. 監聽當前選中分頁的行程內容
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

  // ✨ 新增分頁 (同步更新到群組)
  const createNewTrip = async () => {
    if (!groupId) return;
    const newId = Math.random().toString(36).substring(2, 10);
    await updateDoc(doc(db, "groups", groupId), {
      tripIds: arrayUnion(newId)
    });
    setTripId(newId);
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
      
      <h1 style={{ textAlign: "center", color: "#333" }}>✈️ 團體旅遊規劃</h1>

      {/* 分頁標籤 UI */}
      <div style={{ display: "flex", gap: "5px", overflowX: "auto", marginBottom: "20px", borderBottom: "2px solid #eee" }}>
        {activeTrips.map((id, index) => (
          <div 
            key={id} 
            onClick={() => setTripId(id)}
            style={{
              padding: "10px 20px", borderRadius: "10px 10px 0 0", cursor: "pointer",
              backgroundColor: tripId === id ? "#0070f3" : "#f8f8f8",
              color: tripId === id ? "white" : "#666",
              fontWeight: tripId === id ? "bold" : "normal",
              border: "1px solid #ddd", borderBottom: "none"
            }}
          >
            天數 {index + 1}
          </div>
        ))}
        <button onClick={createNewTrip} style={{ padding: "10px", border: "none", background: "none", cursor: "pointer", color: "#0070f3", fontWeight: "bold" }}>
          ＋ 新增天數
        </button>
      </div>

      <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert("已複製「全行程」分享連結！"); }} 
              style={{ width: "100%", padding: "12px", marginBottom: "20px", borderRadius: "8px", border: "none", backgroundColor: "#34c759", color: "white", fontWeight: "bold", cursor: "pointer" }}>
        📢 分享整個行程 (包含所有分頁)
      </button>

      {/* 輸入區 */}
      <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "12px", marginBottom: "30px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <input placeholder="要去哪裡？" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
        <textarea placeholder="備註" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
        <button onClick={handleAdd} style={{ width: "100%", padding: "12px", backgroundColor: "#0070f3", color: "white", borderRadius: "8px", border: "none", fontWeight: "bold" }}>➕ 加入行程</button>
      </div>

      {/* 列表區 */}
      <div>
        {plans.map((plan) => (
          <div key={plan.id} style={{ border: "1px solid #eee", borderRadius: "12px", padding: "16px", marginBottom: "12px", backgroundColor: "#fff", position: "relative" }}>
            <h3 style={{ margin: "0 0 5px 0" }}>{plan.title}</h3>
            <p style={{ fontSize: "14px", color: "#666" }}>📅 {plan.date || "未定"}</p>
            <p style={{ fontSize: "15px", color: "#444" }}>💡 {plan.note}</p>
            <div style={{ marginTop: "10px", display: "flex", gap: "15px" }}>
              <a href={`https://www.google.com/maps/search/?api=1&query={encodeURIComponent(plan.title)}`} target="_blank" rel="noreferrer" style={{ color: "#0070f3", textDecoration: "none", fontSize: "14px" }}>🗺️ 地圖</a>
              <button onClick={() => deleteDoc(doc(db, "trips", tripId!, "plans", plan.id))} style={{ color: "#ff4d4f", background: "none", border: "none", cursor: "pointer" }}>🗑️ 刪除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}