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
  const [view, setView] = useState<"dashboard" | "planner" | "readonly">("dashboard");
  const [myTrips, setMyTrips] = useState<TripRecord[]>([]);
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [tripId, setTripId] = useState<string | null>(null);
  const [days, setDays] = useState<TripDay[]>([]); 

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  
  // ✨ 編輯模式專用狀態
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");

  // 拖曳狀態
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const touchDragItem = useRef<number | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const gId = searchParams.get("groupId");
    const vTId = searchParams.get("viewTripId");

    if (vTId) {
      setTripId(vTId);
      setView("readonly");
      return;
    }

    const saved = JSON.parse(localStorage.getItem("myTrips") || "[]");
    setMyTrips(saved);

    if (gId) {
      loadTrip(gId);
    }
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

  // 儀表板改名
  const renameTripInDashboard = async (id: string, newName: string) => {
    const updatedTrips = myTrips.map(t => t.id === id ? { ...t, name: newName } : t);
    setMyTrips(updatedTrips);
    localStorage.setItem("myTrips", JSON.stringify(updatedTrips));
    try { await updateDoc(doc(db, "groups", id), { name: newName }); } catch (e) { console.error(e); }
  };

  // 儀表板刪除
  const removeTripFromDashboard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("從列表移除此旅程？")) {
      const updatedTrips = myTrips.filter(t => t.id !== id);
      setMyTrips(updatedTrips);
      localStorage.setItem("myTrips", JSON.stringify(updatedTrips));
    }
  };

  useEffect(() => {
    if (!tripId) return;
    const q = query(collection(db, "trips", tripId, "plans"), orderBy("order", "asc"));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Plan[];
      setPlans(list);
    });
  }, [tripId]);

  // ✨ 儲存編輯功能
  const saveEdit = async (planId: string) => {
    if (!tripId) return;
    try {
      const planRef = doc(db, "trips", tripId, "plans", planId);
      await updateDoc(planRef, {
        title: editTitle,
        note: editNote
      });
      setEditingId(null); // 退出編輯模式
    } catch (e) {
      alert("更新失敗");
    }
  };

  // 拖曳邏輯
  const handleDrop = async (index: number) => {
    if (draggedItemIndex === null || draggedItemIndex === index || view === "readonly") return;
    reorderPlans(draggedItemIndex, index);
    setDraggedItemIndex(null);
  };

  const handleTouchStart = (index: number) => {
    if (view === "readonly" || editingId !== null) return; // 編輯中不允許拖曳
    touchDragItem.current = index;
    setDraggedItemIndex(index); 
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchDragItem.current === null || view === "readonly" || editingId !== null) return;
    const touch = e.touches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = targetElement?.closest('[data-index]');
    if (!row) return;
    const targetIndex = parseInt(row.getAttribute('data-index') || "-1");
    if (targetIndex !== -1 && targetIndex !== touchDragItem.current) {
      reorderPlans(touchDragItem.current, targetIndex);
      touchDragItem.current = targetIndex;
      setDraggedItemIndex(targetIndex);
    }
  };

  const handleTouchEnd = () => {
    touchDragItem.current = null;
    setDraggedItemIndex(null);
    saveOrderToDb();
  };

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
  
  useEffect(() => {
    if (draggedItemIndex === null && plans.length > 0) saveOrderToDb();
  }, [draggedItemIndex]);


  const renderNote = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => urlRegex.test(part) ? <a key={i} href={part} target="_blank" rel="noreferrer" style={{ color: "#007AFF" }}>{part}</a> : part);
  };

  // --- 視圖 A：Dashboard ---
  if (view === "dashboard") {
    return (
      <div style={{ padding: "30px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <h1 style={{ fontWeight: "800", fontSize: "32px", marginBottom: "10px" }}>旅遊總管</h1>
        <p style={{ color: "#666", marginBottom: "30px" }}>個人專屬行程儀表板</p>
        <button onClick={async () => {
          const gId = "grp_" + Math.random().toString(36).substring(2, 10);
          const tId = "day_" + Math.random().toString(36).substring(2, 10);
          await setDoc(doc(db, "groups", gId), { name: "新計畫", days: [{ id: tId, label: "第一天" }] });
          window.location.search = `?groupId=${gId}`;
        }} style={{ width: "100%", padding: "18px", backgroundColor: "#007AFF", color: "white", borderRadius: "15px", border: "none", fontWeight: "bold", fontSize: "16px", marginBottom: "30px", boxShadow: "0 4px 12px rgba(0,122,255,0.3)" }}>✨ 建立新旅程</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}><h2 style={{ fontSize: "18px" }}>我的旅程列表</h2></div>
        {myTrips.length === 0 && <p style={{ color: "#aaa", textAlign: "center", marginTop: "40px" }}>目前沒有旅程紀錄</p>}
        {myTrips.map(trip => (
          <div key={trip.id} onClick={() => loadTrip(trip.id)} style={{ padding: "15px 20px", backgroundColor: "#F2F2F7", borderRadius: "15px", marginBottom: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <span style={{ fontSize: "24px", marginRight: "15px" }}>🌍</span>
              <div style={{ flex: 1 }}>
                <input value={trip.name} onClick={(e) => e.stopPropagation()} onChange={(e) => renameTripInDashboard(trip.id, e.target.value)} style={{ border: "none", background: "transparent", fontWeight: "bold", fontSize: "17px", width: "100%", padding: "5px 0" }} />
                <div style={{ fontSize: "12px", color: "#8E8E93" }}>ID: {trip.id}</div>
              </div>
            </div>
            <button onClick={(e) => removeTripFromDashboard(trip.id, e)} style={{ border: "none", background: "#fff", color: "#FF3B30", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 5px rgba(0,0,0,0.1)", marginLeft: "10px" }}>🗑️</button>
          </div>
        ))}
        {myTrips.length > 0 && <button onClick={() => { if(confirm("確定清空所有紀錄？")) { localStorage.removeItem("myTrips"); setMyTrips([]); } }} style={{ marginTop: "20px", width: "100%", padding: "12px", color: "#999", border: "1px dashed #ddd", background: "none", borderRadius: "10px" }}>清空所有本地紀錄</button>}
      </div>
    );
  }

  // --- 視圖 B & C：規劃與唯讀 ---
  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      {view !== "readonly" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <button onClick={() => { setView("dashboard"); window.history.replaceState(null, "", window.location.pathname); }} style={{ color: "#007AFF", border: "none", background: "none", fontWeight: "bold", fontSize: "16px" }}>❮ 回總管</button>
          <input value={groupName} onChange={(e) => { setGroupName(e.target.value); updateDoc(doc(db, "groups", groupId!), { name: e.target.value }); saveToLocal(groupId!, e.target.value); }} style={{ fontWeight: "bold", border: "none", textAlign: "right", fontSize: "18px", width: "50%" }} />
        </div>
      )}

      {view === "readonly" && <div style={{ textAlign: "center", marginBottom: "30px" }}><h2 style={{ margin: 0 }}>📍 行程分享</h2><p style={{ color: "#666", fontSize: "14px" }}>朋友分享的單日規劃</p></div>}

      {view === "planner" && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert("🔗 已複製：完整旅程連結"); }} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", backgroundColor: "#34C759", color: "white", fontWeight: "bold", fontSize: "13px" }}>📢 分享全部</button>
          <button onClick={() => { const baseUrl = window.location.origin + window.location.pathname; navigator.clipboard.writeText(`${baseUrl}?viewTripId=${tripId}`); alert("🎯 已複製：此分頁唯讀連結"); }} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", backgroundColor: "#5856D6", color: "white", fontWeight: "bold", fontSize: "13px" }}>🎯 僅分享今天</button>
        </div>
      )}

      {view === "planner" && (
        <div style={{ display: "flex", gap: "5px", overflowX: "auto", marginBottom: "20px", paddingBottom: "5px", borderBottom: "1px solid #eee" }}>
          {days.map((day) => (
            <div key={day.id} onClick={() => setTripId(day.id)} style={{ padding: "10px 15px", borderRadius: "10px 10px 0 0", cursor: "pointer", whiteSpace: "nowrap", backgroundColor: tripId === day.id ? "#007AFF" : "#eee", color: tripId === day.id ? "white" : "#666", display: "flex", alignItems: "center", gap: "8px", border: "1px solid #ddd", borderBottom: "none" }}>
              <input value={day.label} onChange={(e) => { const updated = days.map(d => d.id === day.id ? { ...d, label: e.target.value } : d); setDays(updated); updateDoc(doc(db, "groups", groupId!), { days: updated }); }} style={{ background: "none", border: "none", color: "inherit", width: "70px", fontSize: "14px", textAlign: "center" }} />
              <span onClick={async (e) => { e.stopPropagation(); if (days.length <= 1) return; if (confirm("刪除此天？")) { const updated = days.filter(d => d.id !== day.id); await updateDoc(doc(db, "groups", groupId!), { days: updated }); if (tripId === day.id) setTripId(updated[0].id); } }} style={{ fontSize: "12px", opacity: 0.7 }}>✕</span>
            </div>
          ))}
          <button onClick={() => { const newId = "day_" + Math.random().toString(36).substring(2, 10); updateDoc(doc(db, "groups", groupId!), { days: [...days, { id: newId, label: `Day ${days.length + 1}` }] }); setTripId(newId); }} style={{ padding: "10px", color: "#007AFF", border: "none", background: "none", fontWeight: "bold" }}>＋天數</button>
        </div>
      )}

      {view === "planner" && (
        <div style={{ backgroundColor: "#F2F2F7", padding: "15px", borderRadius: "15px", marginBottom: "30px" }}>
          <input placeholder="要去哪裡？" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "10px" }} />
          <textarea placeholder="備註" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "10px" }} />
          <button onClick={async () => { if (!title) return; await addDoc(collection(db, "trips", tripId!, "plans"), { title, note, order: plans.length, createdAt: new Date() }); setTitle(""); setNote(""); }} style={{ width: "100%", padding: "12px", backgroundColor: "#007AFF", color: "white", borderRadius: "10px", border: "none", fontWeight: "bold" }}>➕ 加入行程</button>
        </div>
      )}

      {/* 列表區 (整合編輯與拖曳) */}
      <div onDragOver={(e) => e.preventDefault()} style={{ touchAction: "none" }}>
        {plans.map((plan, index) => (
          <div 
            key={plan.id} 
            data-index={index}
            // 如果是編輯模式，暫時禁用拖曳
            draggable={view === "planner" && editingId !== plan.id} 
            onDragStart={() => setDraggedItemIndex(index)} 
            onDrop={() => handleDrop(index)}
            onTouchStart={() => handleTouchStart(index)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ 
              border: "1px solid #ddd", borderRadius: "15px", padding: "15px", marginBottom: "12px", backgroundColor: "#fff", 
              opacity: draggedItemIndex === index ? 0.5 : 1, 
              cursor: (view === "planner" && editingId !== plan.id) ? "grab" : "default", 
              transition: "transform 0.1s" 
            }}
          >
            {/* ✨ 編輯模式：顯示輸入框 */}
            {editingId === plan.id ? (
              <div onTouchStart={(e) => e.stopPropagation()}> {/* 阻止編輯時觸發拖曳 */}
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "8px", borderRadius: "5px", border: "1px solid #007AFF" }} />
                <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "8px", borderRadius: "5px", border: "1px solid #007AFF" }} />
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => saveEdit(plan.id)} style={{ flex: 1, backgroundColor: "#34C759", color: "white", border: "none", padding: "8px", borderRadius: "5px" }}>儲存</button>
                  <button onClick={() => setEditingId(null)} style={{ flex: 1, backgroundColor: "#8E8E93", color: "white", border: "none", padding: "8px", borderRadius: "5px" }}>取消</button>
                </div>
              </div>
            ) : (
              /* ✨ 瀏覽模式：顯示內容與按鈕 */
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: "18px" }}>{plan.title}</h3>
                  {view === "planner" && <span style={{ color: "#ccc" }}>☰</span>}
                </div>
                {plan.note && <p style={{ fontSize: "15px", margin: "10px 0", color: "#444", whiteSpace: "pre-wrap" }}>💡 {renderNote(plan.note)}</p>}
                
                <div style={{ display: "flex", gap: "15px", marginTop: "10px", borderTop: "1px solid #f9f9f9", paddingTop: "10px" }}>
                  {/* 地圖 */}
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.title)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "#007AFF", fontSize: "14px", fontWeight: "bold" }} onTouchStart={(e) => e.stopPropagation()}>🗺️ 地圖</a>
                  
                  {view === "planner" && (
                    <>
                      {/* ✨ 加回來的編輯按鈕 */}
                      <button onClick={() => { 
                        setEditingId(plan.id); 
                        setEditTitle(plan.title); 
                        setEditNote(plan.note); 
                      }} style={{ color: "#007AFF", border: "none", background: "none", fontSize: "14px", fontWeight: "bold", cursor: "pointer" }} onTouchStart={(e) => e.stopPropagation()}>
                        📝 編輯
                      </button>

                      {/* 刪除按鈕 */}
                      <button onClick={() => deleteDoc(doc(db, "trips", tripId!, "plans", plan.id))} style={{ color: "#FF3B30", border: "none", background: "none", marginLeft: "auto", cursor: "pointer", fontSize: "14px" }} onTouchStart={(e) => e.stopPropagation()}>
                        🗑️ 刪除
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        {plans.length === 0 && <p style={{ textAlign: "center", color: "#999", padding: "40px 0" }}>尚未新增任何行程內容</p>}
      </div>
    </div>
  );
}