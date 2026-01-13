"use client";
import { useState, useEffect } from "react";
import { db } from "./firebase"; 
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, arrayUnion, arrayRemove, setDoc } from "firebase/firestore";

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
  
  const [groupId, setGroupId] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [activeTrips, setActiveTrips] = useState<string[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");

  useEffect(() => {
    async function initGroup() {
      const searchParams = new URLSearchParams(window.location.search);
      let gId = searchParams.get("groupId");

      if (!gId) {
        gId = "group_" + Math.random().toString(36).substring(2, 10);
        const firstTripId = Math.random().toString(36).substring(2, 10);
        await setDoc(doc(db, "groups", gId), { tripIds: [firstTripId] });
        const newUrl = `${window.location.pathname}?groupId=${gId}`;
        window.history.replaceState(null, "", newUrl);
      }
      setGroupId(gId);

      onSnapshot(doc(db, "groups", gId), (docSnap) => {
        if (docSnap.exists()) {
          const ids = docSnap.data().tripIds || [];
          setActiveTrips(ids);
          if (ids.length > 0 && (!tripId || !ids.includes(tripId))) {
            setTripId(ids[0]);
          }
        }
      });
    }
    if (typeof window !== "undefined") initGroup();
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;
    const q = query(collection(db, "trips", tripId, "plans"), orderBy("date", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Plan[];
      setPlans(list);
    });
    return () => unsubscribe();
  }, [tripId]);

  // 新增天數
  const createNewTrip = async () => {
    if (!groupId) return;
    const newId = Math.random().toString(36).substring(2, 10);
    await updateDoc(doc(db, "groups", groupId), { tripIds: arrayUnion(newId) });
    setTripId(newId);
  };

  // 刪除天數
  const deleteDay = async (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!groupId) return;
    if (activeTrips.length <= 1) return alert("至少要保留一天行程喔！");
    
    if (confirm("確定要刪除這整天的行程嗎？")) {
      try {
        await updateDoc(doc(db, "groups", groupId), { tripIds: arrayRemove(idToDelete) });
      } catch (e) { alert("刪除天數失敗"); }
    }
  };

  // 📝 自動轉換備註裡的網址為超連結
  const renderNote = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => 
      urlRegex.test(part) ? (
        <a key={i} href={part} target="_blank" rel="noreferrer" style={{ color: "#0070f3", wordBreak: "break-all" }}>{part}</a>
      ) : part
    );
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

  const saveEdit = async (planId: string) => {
    if (!tripId) return;
    try {
      await updateDoc(doc(db, "trips", tripId, "plans", planId), {
        title: editTitle, date: editDate, note: editNote
      });
      setEditingId(null);
    } catch (e) { alert("更新失敗"); }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center", color: "#333" }}>✈️ 團體旅遊規劃</h1>

      {/* 分頁標籤 */}
      <div style={{ display: "flex", gap: "5px", overflowX: "auto", marginBottom: "15px", borderBottom: "2px solid #eee" }}>
        {activeTrips.map((id, index) => (
          <div key={id} onClick={() => setTripId(id)}
            style={{ 
              padding: "10px 15px", cursor: "pointer", borderRadius: "10px 10px 0 0",
              backgroundColor: tripId === id ? "#0070f3" : "#f0f0f0", 
              color: tripId === id ? "white" : "#666",
              display: "flex", alignItems: "center", gap: "8px", border: "1px solid #ddd", borderBottom: "none",
              whiteSpace: "nowrap"
            }}>
            Day {index + 1}
            <span onClick={(e) => deleteDay(id, e)} style={{ fontSize: "14px", opacity: 0.7 }}>✕</span>
          </div>
        ))}
        <button onClick={createNewTrip} style={{ padding: "10px", border: "none", background: "none", color: "#0070f3", cursor: "pointer", fontWeight: "bold" }}>＋新增天數</button>
      </div>

      <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert("連結已複製！"); }} 
              style={{ width: "100%", padding: "12px", marginBottom: "20px", borderRadius: "8px", border: "none", backgroundColor: "#34c759", color: "white", fontWeight: "bold", cursor: "pointer" }}>
        📢 分享整個行程網址
      </button>

      {/* 輸入區 */}
      <div style={{ backgroundColor: "#f9f9f9", padding: "20px", borderRadius: "12px", marginBottom: "30px", border: "1px solid #eee" }}>
        <input placeholder="要去哪裡？" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
        <textarea placeholder="備註 (貼上網址也會自動變超連結喔！)" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
        <button onClick={handleAdd} style={{ width: "100%", padding: "12px", backgroundColor: "#0070f3", color: "white", borderRadius: "8px", border: "none", fontWeight: "bold" }}>➕ 加入行程</button>
      </div>

      {/* 列表區 */}
      <div>
        {plans.map((plan) => (
          <div key={plan.id} style={{ border: "1px solid #eee", borderRadius: "12px", padding: "16px", marginBottom: "12px", backgroundColor: "#fff" }}>
            {editingId === plan.id ? (
              <div>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: "100%", marginBottom: "5px" }} />
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={{ width: "100%", marginBottom: "5px" }} />
                <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} style={{ width: "100%", marginBottom: "10px" }} />
                <button onClick={() => saveEdit(plan.id)} style={{ marginRight: "10px", backgroundColor: "#34c759", color: "white", padding: "5px 10px", borderRadius: "5px", border: "none" }}>儲存</button>
                <button onClick={() => setEditingId(null)} style={{ backgroundColor: "#888", color: "white", padding: "5px 10px", borderRadius: "5px", border: "none" }}>取消</button>
              </div>
            ) : (
              <div>
                <h3 style={{ margin: "0 0 5px 0" }}>{plan.title}</h3>
                <p style={{ fontSize: "14px", color: "#666" }}>📅 {plan.date || "未定"}</p>
                {/* 使用渲染工具處理備註內容 */}
                <p style={{ fontSize: "15px", color: "#444", whiteSpace: "pre-wrap" }}>💡 {renderNote(plan.note)}</p>
                <div style={{ marginTop: "10px", display: "flex", gap: "15px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.title)}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    style={{ color: "#0070f3", textDecoration: "none", fontSize: "14px", fontWeight: "bold" }}
                  >
                    🗺️ 在地圖查看
                  </a>
                  <button onClick={() => { setEditingId(plan.id); setEditTitle(plan.title); setEditDate(plan.date); setEditNote(plan.note); }} style={{ background: "none", border: "none", color: "#0070f3", fontSize: "14px", cursor: "pointer" }}>📝 編輯</button>
                  <button onClick={() => deleteDoc(doc(db, "trips", tripId!, "plans", plan.id))} style={{ marginLeft: "auto", color: "#ff4d4f", background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}>🗑️ 刪除</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}