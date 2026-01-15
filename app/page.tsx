"use client";
import { useState, useEffect, useRef } from "react";
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
  const [view, setView] = useState<"dashboard" | "planner">("dashboard");
  
  // ✨ 關鍵：兩個獨立的清單
  const [myTrips, setMyTrips] = useState<TripRecord[]>([]);
  const [sharedTrips, setSharedTrips] = useState<TripRecord[]>([]);
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [tripId, setTripId] = useState<string | null>(null);
  const [days, setDays] = useState<TripDay[]>([]); 

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");

  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const touchDragItem = useRef<number | null>(null);

  // --- 1. 核心邏輯：判斷是「我的」還是「分享的」 ---
  useEffect(() => {
    // 先讀取本地紀錄
    const localMy = JSON.parse(localStorage.getItem("myTrips") || "[]");
    const localShared = JSON.parse(localStorage.getItem("sharedTrips") || "[]");
    setMyTrips(localMy);
    setSharedTrips(localShared);

    // 解析網址
    const searchParams = new URLSearchParams(window.location.search);
    const gId = searchParams.get("groupId");

    if (gId) {
      // 檢查這個 ID 是否已經存在於我的清單中
      const isMine = localMy.some((t: TripRecord) => t.id === gId);
      const isShared = localShared.some((t: TripRecord) => t.id === gId);

      // ✨ 如果這不是我建的，而且我也還沒存過 -> 這一定是朋友分享的新連結！
      if (!isMine && !isShared) {
        const newShare = { id: gId, name: "載入中..." };
        const updatedShared = [...localShared, newShare];
        
        // 🔥 強制存入「朋友分享」清單
        localStorage.setItem("sharedTrips", JSON.stringify(updatedShared));
        setSharedTrips(updatedShared);
      }

      loadTrip(gId);
    }
  }, []);

  const loadTrip = (gId: string) => {
    setGroupId(gId);
    setView("planner");
    
    // 監聽 Firebase 資料
    const unsub = onSnapshot(doc(db, "groups", gId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentName = data.name || "未命名旅程";
        setGroupName(currentName);
        
        // ✨ 同步更新本地名稱 (不管在哪個清單，名字都要跟著變)
        updateLocalName(gId, currentName);

        const rawDays = data.days || [];
        setDays(rawDays);

        // 防呆：確保 TripId 存在
        setTripId((prev) => {
            if (!prev && rawDays.length > 0) return rawDays[0].id;
            if (prev && !rawDays.find((d: TripDay) => d.id === prev) && rawDays.length > 0) return rawDays[0].id;
            return prev;
        });
      }
    });
    return unsub;
  };

  // 雙向名稱同步 Helper
  const updateLocalName = (id: string, name: string) => {
    const mySaved = JSON.parse(localStorage.getItem("myTrips") || "[]");
    const sharedSaved = JSON.parse(localStorage.getItem("sharedTrips") || "[]");
    let modified = false;

    // 更新「我建立的」
    const myIndex = mySaved.findIndex((t: TripRecord) => t.id === id);
    if (myIndex > -1 && mySaved[myIndex].name !== name) {
      mySaved[myIndex].name = name;
      localStorage.setItem("myTrips", JSON.stringify(mySaved));
      setMyTrips(mySaved);
      modified = true;
    }

    // 更新「朋友分享的」
    const sharedIndex = sharedSaved.findIndex((t: TripRecord) => t.id === id);
    if (sharedIndex > -1 && sharedSaved[sharedIndex].name !== name) {
      sharedSaved[sharedIndex].name = name;
      localStorage.setItem("sharedTrips", JSON.stringify(sharedSaved));
      setSharedTrips(sharedSaved);
      modified = true;
    }
  };

  // --- 2. 建立新旅程 (只會進「我建立的」) ---
  const createNewTrip = async () => {
    const gId = "grp_" + Math.random().toString(36).substring(2, 10);
    const tId = "day_" + Math.random().toString(36).substring(2, 10);
    const defaultName = "新計畫";
    
    await setDoc(doc(db, "groups", gId), { name: defaultName, days: [{ id: tId, label: "Day 1" }] });
    
    const saved = JSON.parse(localStorage.getItem("myTrips") || "[]");
    saved.push({ id: gId, name: defaultName });
    localStorage.setItem("myTrips", JSON.stringify(saved));
    setMyTrips(saved);

    window.location.search = `?groupId=${gId}`;
  };

  // --- 3. 儀表板改名與刪除 ---
  const renameTripInDashboard = async (id: string, newName: string, listType: "my" | "shared") => {
    const key = listType === "my" ? "myTrips" : "sharedTrips";
    const currentList = JSON.parse(localStorage.getItem(key) || "[]");
    const updated = currentList.map((t: TripRecord) => t.id === id ? { ...t, name: newName } : t);
    
    localStorage.setItem(key, JSON.stringify(updated));
    if (listType === "my") setMyTrips(updated); else setSharedTrips(updated);

    try { await updateDoc(doc(db, "groups", id), { name: newName }); } catch (e) { console.error(e); }
  };

  const removeTrip = (id: string, listType: "my" | "shared", e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("確定從列表移除？(資料庫不會刪除，只有這台裝置看不到)")) {
      const key = listType === "my" ? "myTrips" : "sharedTrips";
      const currentList = JSON.parse(localStorage.getItem(key) || "[]");
      const updated = currentList.filter((t: TripRecord) => t.id !== id);
      
      localStorage.setItem(key, JSON.stringify(updated));
      if (listType === "my") setMyTrips(updated); else setSharedTrips(updated);
    }
  };

  // --- 4. 行程內容操作 ---
  useEffect(() => {
    if (!tripId) return;
    const q = query(collection(db, "trips", tripId, "plans"), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Plan[];
      setPlans(list);
    });
    return unsub;
  }, [tripId]);

  const handleAddPlan = async () => {
    if (!title) return alert("請輸入地點！");
    if (!tripId) return alert("系統載入中...");
    try {
      await addDoc(collection(db, "trips", tripId, "plans"), { title, note, order: plans.length, createdAt: new Date() });
      setTitle(""); setNote("");
    } catch (e) { alert("新增失敗"); }
  };

  const saveEdit = async (planId: string) => {
    if (!tripId) return;
    await updateDoc(doc(db, "trips", tripId, "plans", planId), { title: editTitle, note: editNote });
    setEditingId(null);
  };

  // 拖曳邏輯
  const handleDrop = async (index: number) => {
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    reorderPlans(draggedItemIndex, index);
    setDraggedItemIndex(null);
  };
  const handleTouchStart = (index: number) => {
    if (editingId !== null) return;
    touchDragItem.current = index;
    setDraggedItemIndex(index); 
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchDragItem.current === null || editingId !== null) return;
    const touch = e.touches[0];
    const row = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-index]');
    if (!row) return;
    const targetIndex = parseInt(row.getAttribute('data-index') || "-1");
    if (targetIndex !== -1 && targetIndex !== touchDragItem.current) {
      reorderPlans(touchDragItem.current, targetIndex);
      touchDragItem.current = targetIndex;
      setDraggedItemIndex(targetIndex);
    }
  };
  const handleTouchEnd = () => { touchDragItem.current = null; setDraggedItemIndex(null); saveOrderToDb(); };
  const reorderPlans = (fromIndex: number, toIndex: number) => {
    const newPlans = [...plans];
    const [movedItem] = newPlans.splice(fromIndex, 1);
    newPlans.splice(toIndex, 0, movedItem);
    setPlans(newPlans);
  };
  const saveOrderToDb = async () => {
    if (!tripId) return;
    const batch = writeBatch(db);
    plans.forEach((plan, i) => { batch.update(doc(db, "trips", tripId, "plans", plan.id), { order: i }); });
    await batch.commit();
  };
  useEffect(() => { if (draggedItemIndex === null && plans.length > 0) saveOrderToDb(); }, [draggedItemIndex]);

  const renderNote = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => urlRegex.test(part) ? <a key={i} href={part} target="_blank" rel="noreferrer" style={{ color: "#007AFF" }}>{part}</a> : part);
  };

  // --- 5. 介面渲染 ---
  if (view === "dashboard") {
    return (
      <div style={{ padding: "30px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <h1 style={{ fontWeight: "800", fontSize: "32px", marginBottom: "10px" }}>旅遊總管</h1>
        
        <button onClick={createNewTrip} style={{ width: "100%", padding: "15px", backgroundColor: "#007AFF", color: "white", borderRadius: "12px", border: "none", fontWeight: "bold", fontSize: "16px", marginBottom: "30px", boxShadow: "0 4px 12px rgba(0,122,255,0.3)" }}>
          ✨ 建立新旅程
        </button>

        {/* 區塊 A：我建立的 */}
        <h3 style={{ borderBottom: "2px solid #eee", paddingBottom: "10px", marginBottom: "15px", color: "#333" }}>🏠 我建立的行程</h3>
        {myTrips.length === 0 && <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "30px" }}>尚無建立紀錄</p>}
        {myTrips.map(trip => (
          <div key={trip.id} onClick={() => loadTrip(trip.id)} style={{ padding: "15px", backgroundColor: "#F2F2F7", borderRadius: "12px", marginBottom: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <input value={trip.name} onClick={(e) => e.stopPropagation()} onChange={(e) => renameTripInDashboard(trip.id, e.target.value, "my")} style={{ border: "none", background: "transparent", fontWeight: "bold", fontSize: "16px", width: "100%", padding: "5px 0" }} />
            <button onClick={(e) => removeTrip(trip.id, "my", e)} style={{ border: "none", background: "#fff", color: "#FF3B30", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginLeft: "10px" }}>🗑️</button>
          </div>
        ))}

        {/* 區塊 B：朋友分享的 */}
        <h3 style={{ borderBottom: "2px solid #eee", paddingBottom: "10px", marginBottom: "15px", marginTop: "30px", color: "#007AFF" }}>🤝 朋友分享的行程</h3>
        {sharedTrips.length === 0 && <p style={{ color: "#aaa", fontSize: "14px" }}>點開朋友傳的連結，就會自動出現在這裡！</p>}
        {sharedTrips.map(trip => (
          <div key={trip.id} onClick={() => loadTrip(trip.id)} style={{ padding: "15px", backgroundColor: "#EEF6FF", borderRadius: "12px", marginBottom: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #D6E4FF" }}>
            <input value={trip.name} onClick={(e) => e.stopPropagation()} onChange={(e) => renameTripInDashboard(trip.id, e.target.value, "shared")} style={{ border: "none", background: "transparent", fontWeight: "bold", fontSize: "16px", width: "100%", padding: "5px 0", color: "#0056b3" }} />
            <button onClick={(e) => removeTrip(trip.id, "shared", e)} style={{ border: "none", background: "#fff", color: "#FF3B30", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginLeft: "10px" }}>🗑️</button>
          </div>
        ))}
      </div>
    );
  }

  // 行程規劃頁
  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <button onClick={() => { setView("dashboard"); window.history.replaceState(null, "", window.location.pathname); }} style={{ color: "#007AFF", border: "none", background: "none", fontWeight: "bold", fontSize: "16px" }}>❮ 回總管</button>
        <input value={groupName} onChange={(e) => { setGroupName(e.target.value); updateDoc(doc(db, "groups", groupId!), { name: e.target.value }); }} style={{ fontWeight: "bold", border: "none", textAlign: "right", fontSize: "18px", width: "60%" }} />
      </div>

      {/* ✨ 這裡就是你要的：保持一樣的分享位置，分享單個旅程連結 (擁有編輯權) */}
      <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert("🔗 已複製！朋友點開後可編輯並同步更新！"); }} 
              style={{ width: "100%", padding: "12px", marginBottom: "20px", borderRadius: "10px", border: "none", backgroundColor: "#34C759", color: "white", fontWeight: "bold", cursor: "pointer" }}>
        📢 分享此行程 (可協作編輯)
      </button>

      {/* 天數切換 */}
      <div style={{ display: "flex", gap: "5px", overflowX: "auto", marginBottom: "20px", paddingBottom: "5px", borderBottom: "1px solid #eee" }}>
        {days.map((day) => (
          <div key={day.id} onClick={() => setTripId(day.id)} style={{ padding: "10px 15px", borderRadius: "10px 10px 0 0", cursor: "pointer", whiteSpace: "nowrap", backgroundColor: tripId === day.id ? "#007AFF" : "#eee", color: tripId === day.id ? "white" : "#666", display: "flex", alignItems: "center", gap: "8px", border: "1px solid #ddd", borderBottom: "none" }}>
            <input value={day.label} onChange={(e) => { const updated = days.map(d => d.id === day.id ? { ...d, label: e.target.value } : d); setDays(updated); updateDoc(doc(db, "groups", groupId!), { days: updated }); }} style={{ background: "none", border: "none", color: "inherit", width: "70px", fontSize: "14px", textAlign: "center" }} />
            <span onClick={async (e) => { e.stopPropagation(); if (days.length <= 1) return; if (confirm("刪除此天？")) { const updated = days.filter(d => d.id !== day.id); await updateDoc(doc(db, "groups", groupId!), { days: updated }); if (tripId === day.id) setTripId(updated[0].id); } }} style={{ fontSize: "12px", opacity: 0.7 }}>✕</span>
          </div>
        ))}
        <button onClick={() => { const newId = "day_" + Math.random().toString(36).substring(2, 10); updateDoc(doc(db, "groups", groupId!), { days: [...days, { id: newId, label: `Day ${days.length + 1}` }] }); setTripId(newId); }} style={{ padding: "10px", color: "#007AFF", border: "none", background: "none", fontWeight: "bold" }}>＋天數</button>
      </div>

      {/* 輸入區 */}
      <div style={{ backgroundColor: "#F2F2F7", padding: "15px", borderRadius: "15px", marginBottom: "30px" }}>
        <input placeholder="要去哪裡？" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "10px" }} />
        <textarea placeholder="備註" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "10px" }} />
        <button onClick={handleAddPlan} style={{ width: "100%", padding: "12px", backgroundColor: "#007AFF", color: "white", borderRadius: "10px", border: "none", fontWeight: "bold" }}>➕ 加入行程</button>
      </div>

      {/* 列表區 (拖曳 & 編輯) */}
      <div onDragOver={(e) => e.preventDefault()} style={{ touchAction: "none" }}>
        {plans.map((plan, index) => (
          <div key={plan.id} data-index={index}
            draggable={editingId !== plan.id} 
            onDragStart={() => setDraggedItemIndex(index)} onDrop={() => handleDrop(index)}
            onTouchStart={() => handleTouchStart(index)} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
            style={{ border: "1px solid #ddd", borderRadius: "15px", padding: "15px", marginBottom: "12px", backgroundColor: "#fff", opacity: draggedItemIndex === index ? 0.5 : 1, cursor: editingId !== plan.id ? "grab" : "default", transition: "transform 0.1s" }}>
            
            {editingId === plan.id ? (
              <div onTouchStart={(e) => e.stopPropagation()}>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "8px", borderRadius: "5px", border: "1px solid #007AFF" }} />
                <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "8px", borderRadius: "5px", border: "1px solid #007AFF" }} />
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => saveEdit(plan.id)} style={{ flex: 1, backgroundColor: "#34C759", color: "white", border: "none", padding: "8px", borderRadius: "5px" }}>儲存</button>
                  <button onClick={() => setEditingId(null)} style={{ flex: 1, backgroundColor: "#8E8E93", color: "white", border: "none", padding: "8px", borderRadius: "5px" }}>取消</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: "18px" }}>{plan.title}</h3>
                  <span style={{ color: "#ccc" }}>☰</span>
                </div>
                {plan.note && <p style={{ fontSize: "15px", margin: "10px 0", color: "#444", whiteSpace: "pre-wrap" }}>💡 {renderNote(plan.note)}</p>}
                <div style={{ display: "flex", gap: "15px", marginTop: "10px", borderTop: "1px solid #f9f9f9", paddingTop: "10px" }}>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.title)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "#007AFF", fontSize: "14px", fontWeight: "bold" }} onTouchStart={(e) => e.stopPropagation()}>🗺️ 地圖</a>
                  <button onClick={() => { setEditingId(plan.id); setEditTitle(plan.title); setEditNote(plan.note); }} style={{ color: "#007AFF", border: "none", background: "none", fontSize: "14px", fontWeight: "bold", cursor: "pointer" }} onTouchStart={(e) => e.stopPropagation()}>📝 編輯</button>
                  <button onClick={() => deleteDoc(doc(db, "trips", tripId!, "plans", plan.id))} style={{ color: "#FF3B30", border: "none", background: "none", marginLeft: "auto", cursor: "pointer", fontSize: "14px" }} onTouchStart={(e) => e.stopPropagation()}>🗑️ 刪除</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}