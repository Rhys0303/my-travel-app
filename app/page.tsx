"use client";
import { useState, useEffect } from "react";
import { db } from "./firebase"; 
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, setDoc, writeBatch } from "firebase/firestore";

interface Plan {
  id: string;
  title: string;
  note: string;
  order: number;
}

interface TripDay {
  id: string;
  label: string; 
}

interface TripRecord {
  id: string;
  name: string;
}

export default function Home() {
  const [view, setView] = useState<"dashboard" | "planner" | "readonly">("dashboard");
  const [myTrips, setMyTrips] = useState<TripRecord[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [tripId, setTripId] = useState<string | null>(null);
  const [days, setDays] = useState<TripDay[]>([]); 
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const gId = searchParams.get("groupId");
    const vTId = searchParams.get("viewTripId"); // ✨ 單旅程分享 ID

    // 如果網址是分享單日的
    if (vTId) {
      setTripId(vTId);
      setView("readonly");
      return;
    }

    const saved = JSON.parse(localStorage.getItem("myTrips") || "[]");
    setMyTrips(saved);
    if (gId) loadTrip(gId);
  }, []);

  const loadTrip = (gId: string) => {
    setGroupId(gId);
    setView("planner");
    onSnapshot(doc(db, "groups", gId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGroupName(data.name || "未命名旅程");
        const rawDays = data.days || [];
        setDays(rawDays);
        if (!tripId && rawDays.length > 0) setTripId(rawDays[0].id);
        saveToLocal(gId, data.name || "未命名旅程");
      }
    });
  };

  const saveToLocal = (id: string, name: string) => {
    let saved = JSON.parse(localStorage.getItem("myTrips") || "[]") as TripRecord[];
    const index = saved.findIndex(t => t.id === id);
    if (index > -1) saved[index].name = name;
    else saved.push({ id, name });
    localStorage.setItem("myTrips", JSON.stringify(saved));
    setMyTrips(saved);
  };

  useEffect(() => {
    if (!tripId) return;
    const q = query(collection(db, "trips", tripId, "plans"), orderBy("order", "asc"));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Plan[];
      setPlans(list);
    });
  }, [tripId]);

  const handleDrop = async (index: number) => {
    if (draggedItemIndex === null || draggedItemIndex === index || view === "readonly") return;
    const newPlans = [...plans];
    const [movedItem] = newPlans.splice(draggedItemIndex, 1);
    newPlans.splice(index, 0, movedItem);
    const batch = writeBatch(db);
    newPlans.forEach((plan, i) => { batch.update(doc(db, "trips", tripId!, "plans", plan.id), { order: i }); });
    await batch.commit();
    setDraggedItemIndex(null);
  };

  const renderNote = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => urlRegex.test(part) ? <a key={i} href={part} target="_blank" rel="noreferrer" style={{ color: "#007AFF" }}>{part}</a> : part);
  };

  // --- 視圖 A：大廳 ---
  if (view === "dashboard") {
    return (
      <div style={{ padding: "30px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <h1 style={{ fontWeight: "800" }}>旅遊總管</h1>
        <button onClick={async () => {
          const gId = "grp_" + Math.random().toString(36).substring(2, 10);
          const tId = "day_" + Math.random().toString(36).substring(2, 10);
          await setDoc(doc(db, "groups", gId), { name: "新計畫", days: [{ id: tId, label: "第一天" }] });
          window.location.search = `?groupId=${gId}`;
        }} style={{ width: "100%", padding: "18px", backgroundColor: "#007AFF", color: "white", borderRadius: "15px", border: "none", fontWeight: "bold", fontSize: "16px", marginBottom: "30px" }}>✨ 建立新旅程</button>
        <h3>我的紀錄：</h3>
        {myTrips.map(trip => (
          <div key={trip.id} onClick={() => loadTrip(trip.id)} style={{ padding: "20px", backgroundColor: "#F2F2F7", borderRadius: "15px", marginBottom: "10px", cursor: "pointer" }}>
            <b>{trip.name}</b>
          </div>
        ))}
      </div>
    );
  }

  // --- 視圖 B & C：規劃頁與唯讀頁 ---
  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      {view !== "readonly" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <button onClick={() => { setView("dashboard"); window.history.replaceState(null, "", window.location.pathname); }} style={{ color: "#007AFF", border: "none", background: "none", fontWeight: "bold" }}>❮ 回總管</button>
          <input value={groupName} onChange={(e) => { setGroupName(e.target.value); updateDoc(doc(db, "groups", groupId!), { name: e.target.value }); }} 
                 style={{ fontWeight: "bold", border: "none", textAlign: "right", fontSize: "18px" }} />
        </div>
      )}

      {view === "readonly" && (
        <h2 style={{ textAlign: "center", marginBottom: "20px" }}>📋 朋友分享的行程</h2>
      )}

      {/* 分享按鈕區 */}
      {view !== "readonly" && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert("🔗 已複製：完整旅程連結 (含所有分頁)"); }}
                  style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", backgroundColor: "#34C759", color: "white", fontWeight: "bold", fontSize: "14px" }}>
            📢 分享整個旅程
          </button>
          <button onClick={() => { 
            const baseUrl = window.location.origin + window.location.pathname;
            navigator.clipboard.writeText(`${baseUrl}?viewTripId=${tripId}`); 
            alert("🎯 已複製：此分頁專屬連結 (朋友只能看到這一天)"); 
          }}
                  style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", backgroundColor: "#5856D6", color: "white", fontWeight: "bold", fontSize: "14px" }}>
            🎯 僅分享這一天
          </button>
        </div>
      )}

      {/* 天數切換 (唯讀模式下隱藏) */}
      {view !== "readonly" && (
        <div style={{ display: "flex", gap: "5px", overflowX: "auto", marginBottom: "20px", borderBottom: "1px solid #eee" }}>
          {days.map((day) => (
            <div key={day.id} onClick={() => setTripId(day.id)} style={{
              padding: "10px 15px", borderRadius: "10px 10px 0 0", cursor: "pointer",
              backgroundColor: tripId === day.id ? "#007AFF" : "#eee", color: tripId === day.id ? "white" : "#666"
            }}>
              {day.label}
            </div>
          ))}
          <button onClick={() => {
            const newId = "day_" + Math.random().toString(36).substring(2, 10);
            updateDoc(doc(db, "groups", groupId!), { days: [...days, { id: newId, label: `Day ${days.length + 1}` }] });
          }} style={{ padding: "10px", color: "#007AFF", border: "none", background: "none" }}>＋天數</button>
        </div>
      )}

      {/* 輸入區 (唯讀模式下隱藏) */}
      {view !== "readonly" && (
        <div style={{ backgroundColor: "#F2F2F7", padding: "15px", borderRadius: "15px", marginBottom: "30px" }}>
          <input placeholder="要去哪裡？" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "10px" }} />
          <textarea placeholder="備註" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "10px" }} />
          <button onClick={async () => {
            if (!title) return;
            await addDoc(collection(db, "trips", tripId!, "plans"), { title, note, order: plans.length, createdAt: new Date() });
            setTitle(""); setNote("");
          }} style={{ width: "100%", padding: "12px", backgroundColor: "#007AFF", color: "white", borderRadius: "10px", border: "none", fontWeight: "bold" }}>➕ 加入行程</button>
        </div>
      )}

      {/* 列表區 */}
      <div onDragOver={(e) => e.preventDefault()}>
        {plans.map((plan, index) => (
          <div key={plan.id} draggable={view !== "readonly"} onDragStart={() => setDraggedItemIndex(index)} onDrop={() => handleDrop(index)}
            style={{ border: "1px solid #ddd", borderRadius: "15px", padding: "15px", marginBottom: "12px", backgroundColor: "#fff", cursor: view !== "readonly" ? "grab" : "default" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }}>{plan.title}</h3>
              {view !== "readonly" && <span style={{ color: "#ccc" }}>☰</span>}
            </div>
            {plan.note && <p style={{ fontSize: "15px", margin: "10px 0" }}>💡 {renderNote(plan.note)}</p>}
            <div style={{ display: "flex", gap: "15px", marginTop: "10px", borderTop: "1px solid #f9f9f9", paddingTop: "10px" }}>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.title)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "#007AFF", fontSize: "14px", fontWeight: "bold" }}>🗺️ 地圖</a>
              {view !== "readonly" && (
                <button onClick={() => deleteDoc(doc(db, "trips", tripId!, "plans", plan.id))} style={{ color: "#FF3B30", border: "none", background: "none", marginLeft: "auto", cursor: "pointer" }}>🗑️ 刪除</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}