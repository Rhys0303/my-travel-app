"use client";
import { useState, useEffect } from "react";
import { db } from "./firebase"; 
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, arrayUnion, setDoc, writeBatch } from "firebase/firestore";

// 行程內容的型別 (移除 date)
interface Plan {
  id: string;
  title: string;
  note: string;
  order: number;
}

// 天數/分頁的型別
interface TripDay {
  id: string;
  label: string; 
}

// 本地紀錄的型別
interface TripRecord {
  id: string;
  name: string;
}

export default function Home() {
  const [view, setView] = useState<"dashboard" | "planner">("dashboard");
  const [myTrips, setMyTrips] = useState<TripRecord[]>([]);
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [tripId, setTripId] = useState<string | null>(null);
  const [days, setDays] = useState<TripDay[]>([]); 

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // 初始化：載入本地紀錄與檢查網址
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const gId = searchParams.get("groupId");
    const saved = JSON.parse(localStorage.getItem("myTrips") || "[]");
    setMyTrips(saved);
    if (gId) loadTrip(gId);
  }, []);

  // 載入特定的旅程房間
  const loadTrip = (gId: string) => {
    setGroupId(gId);
    setView("planner");
    onSnapshot(doc(db, "groups", gId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGroupName(data.name || "未命名旅程");
        
        // 處理天數資料
        const rawDays = data.days || [];
        setDays(rawDays);
        if (!tripId && rawDays.length > 0) setTripId(rawDays[0].id);
        
        saveToLocal(gId, data.name || "未命名旅程");
      }
    });
  };

  // 儲存 ID 到本地快取（儀表板清單）
  const saveToLocal = (id: string, name: string) => {
    let saved = JSON.parse(localStorage.getItem("myTrips") || "[]") as TripRecord[];
    const index = saved.findIndex(t => t.id === id);
    if (index > -1) saved[index].name = name;
    else saved.push({ id, name });
    localStorage.setItem("myTrips", JSON.stringify(saved));
    setMyTrips(saved);
  };

  // 監聽目前的行程列表
  useEffect(() => {
    if (!tripId) return;
    const q = query(collection(db, "trips", tripId, "plans"), orderBy("order", "asc"));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Plan[];
      setPlans(list);
    });
  }, [tripId]);

  // 功能：建立新旅程
  const createNewGroup = async () => {
    const gId = "grp_" + Math.random().toString(36).substring(2, 10);
    const tId = "day_" + Math.random().toString(36).substring(2, 10);
    await setDoc(doc(db, "groups", gId), { 
      name: "新計畫", 
      days: [{ id: tId, label: "Day 1" }] 
    });
    window.location.search = `?groupId=${gId}`;
  };

  // 功能：新增天數分頁
  const addNewDay = async () => {
    if (!groupId) return;
    const newId = "day_" + Math.random().toString(36).substring(2, 10);
    const updatedDays = [...days, { id: newId, label: `Day ${days.length + 1}` }];
    await updateDoc(doc(db, "groups", groupId), { days: updatedDays });
    setTripId(newId);
  };

  // 功能：修改分頁名稱
  const renameDay = async (id: string, newLabel: string) => {
    const updatedDays = days.map(d => d.id === id ? { ...d, label: newLabel } : d);
    setDays(updatedDays);
    await updateDoc(doc(db, "groups", groupId!), { days: updatedDays });
  };

  // 功能：刪除分頁
  const deleteDay = async (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (days.length <= 1) return alert("至少要保留一天喔！");
    if (confirm("確定要刪除這整天的行程嗎？")) {
      const updatedDays = days.filter(d => d.id !== idToDelete);
      await updateDoc(doc(db, "groups", groupId!), { days: updatedDays });
      if (tripId === idToDelete) setTripId(updatedDays[0].id);
    }
  };

  // 拖曳排序
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const handleDrop = async (index: number) => {
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const newPlans = [...plans];
    const [movedItem] = newPlans.splice(draggedItemIndex, 1);
    newPlans.splice(index, 0, movedItem);
    const batch = writeBatch(db);
    newPlans.forEach((plan, i) => { 
      batch.update(doc(db, "trips", tripId!, "plans", plan.id), { order: i }); 
    });
    await batch.commit();
    setDraggedItemIndex(null);
  };

  // 網址自動辨識
  const renderNote = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => 
      urlRegex.test(part) ? <a key={i} href={part} target="_blank" rel="noreferrer" style={{ color: "#007AFF" }}>{part}</a> : part
    );
  };

  // --- 視圖 A：個人儀表板 ---
  if (view === "dashboard") {
    return (
      <div style={{ padding: "30px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <h1 style={{ fontWeight: "800", marginBottom: "5px" }}>旅遊總管</h1>
        <p style={{ color: "#666", marginBottom: "30px" }}>你的專屬行程空間</p>
        
        <button onClick={createNewGroup} style={{ width: "100%", padding: "18px", backgroundColor: "#007AFF", color: "white", borderRadius: "15px", border: "none", fontWeight: "bold", fontSize: "16px", marginBottom: "30px" }}>
          ✨ 建立新旅程
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <h2 style={{ fontSize: "18px" }}>最近的計畫</h2>
          {myTrips.length > 0 && (
            <button onClick={() => { if(confirm("確定清空紀錄？")) { localStorage.removeItem("myTrips"); setMyTrips([]); } }} style={{ color: "red", border: "none", background: "none", fontSize: "14px" }}>🗑️ 清空紀錄</button>
          )}
        </div>

        {myTrips.map(trip => (
          <div key={trip.id} onClick={() => loadTrip(trip.id)} style={{ padding: "20px", backgroundColor: "#F2F2F7", borderRadius: "15px", marginBottom: "10px", cursor: "pointer" }}>
            <b style={{ fontSize: "17px" }}>{trip.name}</b>
            <div style={{ fontSize: "12px", color: "#8E8E93", marginTop: "4px" }}>ID: {trip.id}</div>
          </div>
        ))}
      </div>
    );
  }

  // --- 視圖 B：行程規劃頁 (無日期) ---
  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <button onClick={() => { setView("dashboard"); window.history.replaceState(null, "", window.location.pathname); }} style={{ color: "#007AFF", border: "none", background: "none", fontWeight: "bold" }}>❮ 我的總管</button>
        <input 
          value={groupName} 
          onChange={(e) => { setGroupName(e.target.value); updateDoc(doc(db, "groups", groupId!), { name: e.target.value }); saveToLocal(groupId!, e.target.value); }} 
          style={{ fontWeight: "bold", border: "none", textAlign: "right", fontSize: "18px", width: "50%" }} 
        />
      </div>

      {/* 分頁標籤 (支援改名與刪除) */}
      <div style={{ display: "flex", gap: "5px", overflowX: "auto", marginBottom: "20px", paddingBottom: "5px", borderBottom: "1px solid #eee" }}>
        {days.map((day) => (
          <div key={day.id} onClick={() => setTripId(day.id)} style={{
            padding: "10px 15px", borderRadius: "10px 10px 0 0", cursor: "pointer", whiteSpace: "nowrap",
            backgroundColor: tripId === day.id ? "#007AFF" : "#eee", color: tripId === day.id ? "white" : "#666",
            display: "flex", alignItems: "center", gap: "8px", border: "1px solid #ddd", borderBottom: "none"
          }}>
            <input 
              value={day.label} 
              onChange={(e) => renameDay(day.id, e.target.value)}
              style={{ background: "none", border: "none", color: "inherit", width: "70px", fontSize: "14px", textAlign: "center" }} 
            />
            <span onClick={(e) => deleteDay(day.id, e)} style={{ fontSize: "12px", opacity: 0.7 }}>✕</span>
          </div>
        ))}
        <button onClick={addNewDay} style={{ padding: "10px", color: "#007AFF", background: "none", border: "none", fontWeight: "bold" }}>＋天數</button>
      </div>

      {/* 輸入區 (僅地點與備註) */}
      <div style={{ backgroundColor: "#F2F2F7", padding: "15px", borderRadius: "15px", marginBottom: "30px" }}>
        <input placeholder="要去哪裡？" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "10px" }} />
        <textarea placeholder="備註 (貼上地圖連結也會變超連結)" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "10px" }} />
        <button onClick={async () => {
          if (!title) return;
          await addDoc(collection(db, "trips", tripId!, "plans"), { title, note, order: plans.length, createdAt: new Date() });
          setTitle(""); setNote("");
        }} style={{ width: "100%", padding: "12px", backgroundColor: "#34C759", color: "white", borderRadius: "10px", border: "none", fontWeight: "bold" }}>➕ 加入行程</button>
      </div>

      {/* 行程列表 (支援拖曳) */}
      <div onDragOver={(e) => e.preventDefault()}>
        {plans.map((plan, index) => (
          <div key={plan.id} draggable onDragStart={() => setDraggedItemIndex(index)} onDrop={() => handleDrop(index)}
            style={{ border: "1px solid #ddd", borderRadius: "15px", padding: "15px", marginBottom: "12px", backgroundColor: "#fff", opacity: draggedItemIndex === index ? 0.5 : 1, cursor: "grab" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px" }}>{plan.title}</h3>
              <span style={{ color: "#ccc" }}>☰</span>
            </div>
            {plan.note && <p style={{ fontSize: "15px", margin: "10px 0", color: "#444", whiteSpace: "pre-wrap" }}>💡 {renderNote(plan.note)}</p>}
            <div style={{ display: "flex", gap: "15px", marginTop: "10px", borderTop: "1px solid #f9f9f9", paddingTop: "10px" }}>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.title)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "#007AFF", fontSize: "14px", fontWeight: "bold" }}>🗺️ 地圖</a>
              <button onClick={() => deleteDoc(doc(db, "trips", tripId!, "plans", plan.id))} style={{ color: "#FF3B30", border: "none", background: "none", marginLeft: "auto", cursor: "pointer", fontSize: "14px" }}>🗑️ 刪除</button>
            </div>
          </div>
        ))}
        {plans.length === 0 && <p style={{ textAlign: "center", color: "#999", marginTop: "20px" }}>這天還沒有行程，快點新增吧！</p>}
      </div>
    </div>
  );
}