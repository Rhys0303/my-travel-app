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
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const touchDragItem = useRef<number | null>(null);

  // 初始化與自動分類
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

      // 如果是新的分享連結
      if (!isMine && !isShared) {
        const newShare = { id: gId, name: "載入分享行程..." };
        const updatedShared = [...localShared, newShare];
        localStorage.setItem("sharedTrips", JSON.stringify(updatedShared));
        setSharedTrips(updatedShared);
      }
      loadTrip(gId);
    }
  }, []);

  // ✨ 修正後的 loadTrip：會同步更新網址列
  const loadTrip = (gId: string) => {
    setGroupId(gId);
    setView("planner");
    
    // 更新網址列，確保分享時 href 是正確的
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

  // 儀表板改名與刪除 (省略部分重複邏輯...)
  const renameTripInDashboard = async (id: string, newName: string, listType: "my" | "shared") => {
    const key = listType === "my" ? "myTrips" : "sharedTrips";
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    const updated = list.map((t: TripRecord) => t.id === id ? { ...t, name: newName } : t);
    localStorage.setItem(key, JSON.stringify(updated));
    if (listType === "my") setMyTrips(updated); else setSharedTrips(updated);
    await updateDoc(doc(db, "groups", id), { name: newName });
  };

  const removeTrip = (id: string, listType: "my" | "shared", e: React.MouseEvent) => {
    e.stopPropagation();
    const key = listType === "my" ? "myTrips" : "sharedTrips";
    const updated = JSON.parse(localStorage.getItem(key) || "[]").filter((t: any) => t.id !== id);
    localStorage.setItem(key, JSON.stringify(updated));
    if (listType === "my") setMyTrips(updated); else setSharedTrips(updated);
  };

  const createNewTrip = async () => {
    const gId = "grp_" + Math.random().toString(36).substring(2, 10);
    const tId = "day_" + Math.random().toString(36).substring(2, 10);
    await setDoc(doc(db, "groups", gId), { name: "新旅程", days: [{ id: tId, label: "Day 1" }] });
    const saved = JSON.parse(localStorage.getItem("myTrips") || "[]");
    saved.push({ id: gId, name: "新旅程" });
    localStorage.setItem("myTrips", JSON.stringify(saved));
    window.location.href = `?groupId=${gId}`;
  };

  // 行程列表同步 (省略重複...)
  useEffect(() => {
    if (!tripId) return;
    const q = query(collection(db, "trips", tripId, "plans"), orderBy("order", "asc"));
    return onSnapshot(q, (snapshot) => {
      setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Plan[]);
    });
  }, [tripId]);

  // 排序、編輯、新增邏輯 (省略重複...)
  const handleAddPlan = async () => {
    if (!title || !tripId) return;
    await addDoc(collection(db, "trips", tripId, "plans"), { title, note, order: plans.length });
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
    const batch = writeBatch(db);
    plans.forEach((p, i) => batch.update(doc(db, "trips", tripId!, "plans", p.id), { order: i }));
    await batch.commit();
  };

  const renderNote = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => urlRegex.test(part) ? <a key={i} href={part} target="_blank" rel="noreferrer" style={{ color: "#007AFF" }}>{part}</a> : part);
  };

  // --- 介面 ---
  if (view === "dashboard") {
    return (
      <div style={{ padding: "30px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <h1 style={{ fontWeight: "800", fontSize: "32px" }}>我想浪的地點們</h1>
        <button onClick={createNewTrip} style={{ width: "100%", padding: "15px", backgroundColor: "#007AFF", color: "white", borderRadius: "12px", border: "none", fontWeight: "bold", margin: "20px 0" }}>✨ 建立新旅程</button>

        <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "10px" }}>🏠 我建立的行程</h3>
        {myTrips.map(trip => (
          <div key={trip.id} onClick={() => loadTrip(trip.id)} style={{ padding: "15px", backgroundColor: "#F2F2F7", borderRadius: "12px", marginBottom: "10px", display: "flex", justifyContent: "space-between" }}>
            <input value={trip.name} onClick={(e) => e.stopPropagation()} onChange={(e) => renameTripInDashboard(trip.id, e.target.value, "my")} style={{ border: "none", background: "transparent", fontWeight: "bold", flex: 1 }} />
            <button onClick={(e) => removeTrip(trip.id, "my", e)} style={{ border: "none", color: "red", background: "none" }}>🗑️</button>
          </div>
        ))}

        <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "10px", marginTop: "30px", color: "#007AFF" }}>🤝 朋友揪你去浪</h3>
        {sharedTrips.map(trip => (
          <div key={trip.id} onClick={() => loadTrip(trip.id)} style={{ padding: "15px", backgroundColor: "#EEF6FF", borderRadius: "12px", marginBottom: "10px", display: "flex", justifyContent: "space-between", border: "1px solid #D6E4FF" }}>
            <input value={trip.name} onClick={(e) => e.stopPropagation()} onChange={(e) => renameTripInDashboard(trip.id, e.target.value, "shared")} style={{ border: "none", background: "transparent", fontWeight: "bold", color: "#0056b3", flex: 1 }} />
            <button onClick={(e) => removeTrip(trip.id, "shared", e)} style={{ border: "none", color: "red", background: "none" }}>🗑️</button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <button onClick={() => { setView("dashboard"); window.history.pushState(null, "", window.location.pathname); }} style={{ color: "#007AFF", border: "none", background: "none", fontWeight: "bold" }}>❮ 回總管</button>
        <input value={groupName} onChange={(e) => { setGroupName(e.target.value); updateDoc(doc(db, "groups", groupId!), { name: e.target.value }); }} style={{ fontWeight: "bold", border: "none", textAlign: "right", width: "50%" }} />
      </div>

      {/* ✨ 強化版的分享按鈕：確保連結一定包含 groupId */}
      <button 
        onClick={() => { 
          const shareUrl = `${window.location.origin}${window.location.pathname}?groupId=${groupId}`;
          navigator.clipboard.writeText(shareUrl); 
          alert("✅ 旅程連結已複製！發送給朋友，他們點開後會自動存入『分享行程』並可一起編輯。"); 
        }} 
        style={{ width: "100%", padding: "12px", backgroundColor: "#34C759", color: "white", borderRadius: "10px", border: "none", fontWeight: "bold", marginBottom: "20px" }}
      >
        📢 揪你朋友一起去浪啦
      </button>

      <div style={{ display: "flex", gap: "5px", overflowX: "auto", marginBottom: "20px" }}>
        {days.map(day => (
          <div key={day.id} onClick={() => setTripId(day.id)} style={{ padding: "10px 15px", borderRadius: "10px", backgroundColor: tripId === day.id ? "#007AFF" : "#eee", color: tripId === day.id ? "white" : "#666" }}>
            <input value={day.label} onChange={(e) => {
              const updated = days.map(d => d.id === day.id ? { ...d, label: e.target.value } : d);
              setDays(updated);
              updateDoc(doc(db, "groups", groupId!), { days: updated });
            }} style={{ border: "none", background: "none", color: "inherit", width: "60px", textAlign: "center" }} />
          </div>
        ))}
        <button onClick={() => {
          const newId = "day_" + Math.random().toString(36).substring(2, 10);
          updateDoc(doc(db, "groups", groupId!), { days: [...days, { id: newId, label: `Day ${days.length + 1}` }] });
        }} style={{ border: "none", background: "none", color: "#007AFF" }}>＋天數</button>
      </div>

      <div style={{ backgroundColor: "#F2F2F7", padding: "15px", borderRadius: "15px", marginBottom: "20px" }}>
        <input placeholder="要去哪浪？" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "10px" }} />
        <textarea placeholder="備註" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "10px" }} />
        <button onClick={handleAddPlan} style={{ width: "100%", padding: "10px", backgroundColor: "#007AFF", color: "white", borderRadius: "8px", border: "none" }}>➕ 加入行程</button>
      </div>

      <div style={{ touchAction: "none" }}>
        {plans.map((plan, index) => (
          <div key={plan.id} data-index={index} 
               draggable onDragStart={() => setDraggedItemIndex(index)} 
               onDrop={() => { reorderPlans(draggedItemIndex!, index); setDraggedItemIndex(null); saveOrderToDb(); }}
               onTouchStart={() => { touchDragItem.current = index; setDraggedItemIndex(index); }}
               onTouchMove={(e) => {
                 const target = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY)?.closest('[data-index]');
                 if (target) {
                   const targetIdx = parseInt(target.getAttribute('data-index')!);
                   if (targetIdx !== touchDragItem.current) { reorderPlans(touchDragItem.current!, targetIdx); touchDragItem.current = targetIdx; }
                 }
               }}
               onTouchEnd={() => { touchDragItem.current = null; setDraggedItemIndex(null); saveOrderToDb(); }}
               style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "12px", marginBottom: "10px", backgroundColor: "#fff", opacity: draggedItemIndex === index ? 0.5 : 1 }}>
            {editingId === plan.id ? (
              <div>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: "100%", marginBottom: "5px" }} />
                <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} style={{ width: "100%", marginBottom: "10px" }} />
                <button onClick={() => saveEdit(plan.id)} style={{ backgroundColor: "#34C759", color: "white", padding: "5px 10px", borderRadius: "5px" }}>儲存</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between" }}><b>{plan.title}</b><span>☰</span></div>
                <p style={{ fontSize: "14px", color: "#444" }}>{renderNote(plan.note)}</p>
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.title)}`} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "#007AFF" }}>🗺️ 地圖</a>
                  <button onClick={() => { setEditingId(plan.id); setEditTitle(plan.title); setEditNote(plan.note); }} style={{ background: "none", border: "none", color: "#007AFF", fontSize: "12px" }}>📝 編輯</button>
                  <button onClick={() => deleteDoc(doc(db, "trips", tripId!, "plans", plan.id))} style={{ background: "none", border: "none", color: "red", fontSize: "12px", marginLeft: "auto" }}>🗑️ 刪除</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}