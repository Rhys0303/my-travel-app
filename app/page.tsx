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
  const [myTrips, setMyTrips] = useState<TripRecord[]>([]);
  const [sharedTrips, setSharedTrips] = useState<TripRecord[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [tripId, setTripId] = useState<string | null>(null);
  const [days, setDays] = useState<TripDay[]>([]); 

  // ✨ 大廳編輯名稱專用狀態
  const [dbEditId, setDbEditId] = useState<string | null>(null);
  const [dbEditName, setDbEditName] = useState("");

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const touchDragItem = useRef<number | null>(null);

  useEffect(() => {
    const localMy = JSON.parse(localStorage.getItem("myTrips") || "[]");
    const localShared = JSON.parse(localStorage.getItem("sharedTrips") || "[]");
    setMyTrips(localMy);
    setSharedTrips(localShared);

    const searchParams = new URLSearchParams(window.location.search);
    const gId = searchParams.get("groupId");

    if (gId) {
      const isMine = localMy.some((t: TripRecord) => t.id === gId);
      const isShared = localShared.some((t: TripRecord) => t.id === gId);
      if (!isMine && !isShared) {
        const newShare = { id: gId, name: "載入分享行程..." };
        const updatedShared = [...localShared, newShare];
        localStorage.setItem("sharedTrips", JSON.stringify(updatedShared));
        setSharedTrips(updatedShared);
      }
      loadTrip(gId);
    }
  }, []);

  const loadTrip = (gId: string) => {
    setGroupId(gId);
    setView("planner");
    const newUrl = `${window.location.pathname}?groupId=${gId}`;
    window.history.pushState({ groupId: gId }, "", newUrl);

    onSnapshot(doc(db, "groups", gId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentName = data.name || "未命名旅程";
        setGroupName(currentName);
        updateLocalName(gId, currentName);
        const rawDays = data.days || [];
        setDays(rawDays);
        if (!tripId && rawDays.length > 0) setTripId(rawDays[0].id);
      }
    });
  };

  const updateLocalName = (id: string, name: string) => {
    const mySaved = JSON.parse(localStorage.getItem("myTrips") || "[]");
    const sharedSaved = JSON.parse(localStorage.getItem("sharedTrips") || "[]");
    const myIndex = mySaved.findIndex((t: TripRecord) => t.id === id);
    if (myIndex > -1) {
      mySaved[myIndex].name = name;
      localStorage.setItem("myTrips", JSON.stringify(mySaved));
      setMyTrips(mySaved);
    }
    const sharedIndex = sharedSaved.findIndex((t: TripRecord) => t.id === id);
    if (sharedIndex > -1) {
      sharedSaved[sharedIndex].name = name;
      localStorage.setItem("sharedTrips", JSON.stringify(sharedSaved));
      setSharedTrips(sharedSaved);
    }
  };

  // ✨ 大廳更名儲存
  const saveDashboardRename = async (id: string, listType: "my" | "shared") => {
    const key = listType === "my" ? "myTrips" : "sharedTrips";
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    const updated = list.map((t: TripRecord) => t.id === id ? { ...t, name: dbEditName } : t);
    localStorage.setItem(key, JSON.stringify(updated));
    if (listType === "my") setMyTrips(updated); else setSharedTrips(updated);
    
    await updateDoc(doc(db, "groups", id), { name: dbEditName });
    setDbEditId(null);
  };

  const removeTrip = (id: string, listType: "my" | "shared", e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("確定從列表移除？")) return;
    const key = listType === "my" ? "myTrips" : "sharedTrips";
    const updated = JSON.parse(localStorage.getItem(key) || "[]").filter((t: any) => t.id !== id);
    localStorage.setItem(key, JSON.stringify(updated));
    if (listType === "my") setMyTrips(updated); else setSharedTrips(updated);
  };

  const createNewTrip = async () => {
    const gId = "grp_" + Math.random().toString(36).substring(2, 10);
    const tId = "day_" + Math.random().toString(36).substring(2, 10);
    await setDoc(doc(db, "groups", gId), { name: "新計畫", days: [{ id: tId, label: "Day 1" }] });
    const saved = JSON.parse(localStorage.getItem("myTrips") || "[]");
    saved.push({ id: gId, name: "新計畫" });
    localStorage.setItem("myTrips", JSON.stringify(saved));
    window.location.href = `?groupId=${gId}`;
  };

  useEffect(() => {
    if (!tripId) return;
    const q = query(collection(db, "trips", tripId, "plans"), orderBy("order", "asc"));
    return onSnapshot(q, (snapshot) => {
      setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Plan[]);
    });
  }, [tripId]);

  const handleAddPlan = async () => {
    if (!title || !tripId) return;
    await addDoc(collection(db, "trips", tripId, "plans"), { title, note, order: plans.length, createdAt: new Date() });
    setTitle(""); setNote("");
  };

  const saveEdit = async (id: string) => {
    await updateDoc(doc(db, "trips", tripId!, "plans", id), { title: editTitle, note: editNote });
    setEditingId(null);
  };

  const reorderPlans = (from: number, to: number) => {
    const newPlans = [...plans];
    const [item] = newPlans.splice(from, 1);
    newPlans.splice(to, 0, item);
    setPlans(newPlans);
  };

  const saveOrderToDb = async () => {
    if (!tripId) return;
    const batch = writeBatch(db);
    plans.forEach((p, i) => batch.update(doc(db, "trips", tripId!, "plans", p.id), { order: i }));
    await batch.commit();
  };

  const renderNote = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => urlRegex.test(part) ? <a key={i} href={part} target="_blank" rel="noreferrer" style={{ color: "#007AFF" }}>{part}</a> : part);
  };

  // --- 視圖 A：大廳 Dashboard ---
  if (view === "dashboard") {
    return (
      <div style={{ padding: "30px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <h1 style={{ fontWeight: "800", fontSize: "32px", marginBottom: "20px" }}>旅遊總管</h1>
        <button onClick={createNewTrip} style={{ width: "100%", padding: "18px", backgroundColor: "#007AFF", color: "white", borderRadius: "15px", border: "none", fontWeight: "bold", fontSize: "16px", marginBottom: "30px", boxShadow: "0 4px 12px rgba(0,122,255,0.3)" }}>✨ 建立新旅程</button>

        <h3 style={{ borderBottom: "2px solid #eee", paddingBottom: "10px", marginBottom: "15px" }}>🏠 我建立的行程</h3>
        {myTrips.map(trip => (
          <div key={trip.id} onClick={() => loadTrip(trip.id)} style={{ padding: "15px 20px", backgroundColor: "#F2F2F7", borderRadius: "15px", marginBottom: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {dbEditId === trip.id ? (
              <div style={{ flex: 1, display: "flex", gap: "10px" }} onClick={(e) => e.stopPropagation()}>
                <input value={dbEditName} onChange={(e) => setDbEditName(e.target.value)} style={{ flex: 1, padding: "5px", borderRadius: "5px", border: "1px solid #007AFF" }} />
                <button onClick={() => saveDashboardRename(trip.id, "my")} style={{ padding: "5px 10px", backgroundColor: "#34C759", color: "white", border: "none", borderRadius: "5px" }}>儲存</button>
              </div>
            ) : (
              <>
                <b style={{ fontSize: "17px", flex: 1 }}>{trip.name}</b>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={(e) => { e.stopPropagation(); setDbEditId(trip.id); setDbEditName(trip.name); }} style={{ background: "#fff", border: "none", borderRadius: "50%", width: "32px", height: "32px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>📝</button>
                  <button onClick={(e) => removeTrip(trip.id, "my", e)} style={{ background: "#fff", border: "none", borderRadius: "50%", width: "32px", height: "32px", color: "red", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>🗑️</button>
                </div>
              </>
            )}
          </div>
        ))}

        <h3 style={{ borderBottom: "2px solid #eee", paddingBottom: "10px", marginTop: "30px", color: "#007AFF", marginBottom: "15px" }}>🤝 朋友分享的行程</h3>
        {sharedTrips.map(trip => (
          <div key={trip.id} onClick={() => loadTrip(trip.id)} style={{ padding: "15px 20px", backgroundColor: "#EEF6FF", borderRadius: "15px", marginBottom: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #D6E4FF" }}>
            {dbEditId === trip.id ? (
              <div style={{ flex: 1, display: "flex", gap: "10px" }} onClick={(e) => e.stopPropagation()}>
                <input value={dbEditName} onChange={(e) => setDbEditName(e.target.value)} style={{ flex: 1, padding: "5px", borderRadius: "5px", border: "1px solid #007AFF" }} />
                <button onClick={() => saveDashboardRename(trip.id, "shared")} style={{ padding: "5px 10px", backgroundColor: "#34C759", color: "white", border: "none", borderRadius: "5px" }}>儲存</button>
              </div>
            ) : (
              <>
                <b style={{ fontSize: "17px", flex: 1, color: "#0056b3" }}>{trip.name}</b>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={(e) => { e.stopPropagation(); setDbEditId(trip.id); setDbEditName(trip.name); }} style={{ background: "#fff", border: "none", borderRadius: "50%", width: "32px", height: "32px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>📝</button>
                  <button onClick={(e) => removeTrip(trip.id, "shared", e)} style={{ background: "#fff", border: "none", borderRadius: "50%", width: "32px", height: "32px", color: "red", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>🗑️</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  }

  // --- 視圖 B：行程規劃 Planner ---
  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <button onClick={() => { setView("dashboard"); window.history.pushState(null, "", window.location.pathname); }} style={{ color: "#007AFF", border: "none", background: "none", fontWeight: "bold", fontSize: "16px" }}>❮ 回總管</button>
        <input value={groupName} onChange={(e) => { setGroupName(e.target.value); updateDoc(doc(db, "groups", groupId!), { name: e.target.value }); }} style={{ fontWeight: "bold", border: "none", textAlign: "right", fontSize: "18px", width: "60%" }} />
      </div>

      <button onClick={() => { 
        const shareUrl = `${window.location.origin}${window.location.pathname}?groupId=${groupId}`;
        navigator.clipboard.writeText(shareUrl); 
        alert("✅ 連結已複製！發送給朋友，他們點開後可一起編輯。"); 
      }} style={{ width: "100%", padding: "12px", backgroundColor: "#34C759", color: "white", borderRadius: "10px", border: "none", fontWeight: "bold", marginBottom: "20px" }}>📢 分享此旅程給朋友</button>

      <div style={{ display: "flex", gap: "5px", overflowX: "auto", marginBottom: "20px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>
        {days.map(day => (
          <div key={day.id} onClick={() => setTripId(day.id)} style={{ padding: "10px 15px", borderRadius: "10px 10px 0 0", backgroundColor: tripId === day.id ? "#007AFF" : "#eee", color: tripId === day.id ? "white" : "#666", display: "flex", gap: "8px", alignItems: "center" }}>
            <input value={day.label} onChange={(e) => {
              const updated = days.map(d => d.id === day.id ? { ...d, label: e.target.value } : d);
              setDays(updated);
              updateDoc(doc(db, "groups", groupId!), { days: updated });
            }} style={{ border: "none", background: "none", color: "inherit", width: "60px", textAlign: "center", fontSize: "14px" }} />
            <span onClick={async (e) => { e.stopPropagation(); if (days.length <= 1) return; if (confirm("刪除此天？")) { const updated = days.filter(d => d.id !== day.id); await updateDoc(doc(db, "groups", groupId!), { days: updated }); if (tripId === day.id) setTripId(updated[0].id); } }} style={{ fontSize: "12px", opacity: 0.7 }}>✕</span>
          </div>
        ))}
        <button onClick={() => {
          const newId = "day_" + Math.random().toString(36).substring(2, 10);
          updateDoc(doc(db, "groups", groupId!), { days: [...days, { id: newId, label: `Day ${days.length + 1}` }] });
          setTripId(newId);
        }} style={{ border: "none", background: "none", color: "#007AFF", fontWeight: "bold", padding: "10px" }}>＋天數</button>
      </div>

      <div style={{ backgroundColor: "#F2F2F7", padding: "15px", borderRadius: "15px", marginBottom: "30px" }}>
        <input placeholder="要去哪裡？" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "10px" }} />
        <textarea placeholder="備註" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "10px" }} />
        <button onClick={handleAddPlan} style={{ width: "100%", padding: "12px", backgroundColor: "#007AFF", color: "white", borderRadius: "10px", border: "none", fontWeight: "bold" }}>➕ 加入行程</button>
      </div>

      <div onDragOver={(e) => e.preventDefault()} style={{ touchAction: "none" }}>
        {plans.map((plan, index) => (
          <div key={plan.id} data-index={index} 
               draggable={editingId !== plan.id} 
               onDragStart={() => setDraggedItemIndex(index)} 
               onDrop={() => { reorderPlans(draggedItemIndex!, index); setDraggedItemIndex(null); saveOrderToDb(); }}
               onTouchStart={() => { if(editingId === null) { touchDragItem.current = index; setDraggedItemIndex(index); } }}
               onTouchMove={(e) => {
                 if (touchDragItem.current === null) return;
                 const target = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY)?.closest('[data-index]');
                 if (target) {
                   const targetIdx = parseInt(target.getAttribute('data-index')!);
                   if (targetIdx !== touchDragItem.current) { reorderPlans(touchDragItem.current!, targetIdx); touchDragItem.current = targetIdx; }
                 }
               }}
               onTouchEnd={() => { touchDragItem.current = null; setDraggedItemIndex(null); saveOrderToDb(); }}
               style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "15px", marginBottom: "12px", backgroundColor: "#fff", opacity: draggedItemIndex === index ? 0.5 : 1, cursor: editingId !== plan.id ? "grab" : "default" }}>
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
                  <button onClick={() => { setEditingId(plan.id); setEditTitle(plan.title); setEditNote(plan.note); }} style={{ color: "#007AFF", border: "none", background: "none", fontSize: "14px", fontWeight: "bold" }} onTouchStart={(e) => e.stopPropagation()}>📝 編輯</button>
                  <button onClick={() => deleteDoc(doc(db, "trips", tripId!, "plans", plan.id))} style={{ color: "#FF3B30", border: "none", background: "none", marginLeft: "auto", fontSize: "14px" }} onTouchStart={(e) => e.stopPropagation()}>🗑️ 刪除</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}