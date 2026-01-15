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
  
  // 兩大核心清單
  const [myTrips, setMyTrips] = useState<TripRecord[]>([]);
  const [sharedTrips, setSharedTrips] = useState<TripRecord[]>([]);
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [tripId, setTripId] = useState<string | null>(null);
  const [days, setDays] = useState<TripDay[]>([]); 

  // UI 狀態
  const [dbEditId, setDbEditId] = useState<string | null>(null);
  const [dbEditName, setDbEditName] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const touchDragItem = useRef<number | null>(null);

  // --- 1. 強化初始化邏輯：確保所有紀錄都能被看到 ---
  useEffect(() => {
    // A. 立即載入本地所有紀錄
    const localMy = JSON.parse(localStorage.getItem("myTrips") || "[]");
    const localShared = JSON.parse(localStorage.getItem("sharedTrips") || "[]");
    setMyTrips(localMy);
    setSharedTrips(localShared);

    // B. 檢查網址是否有 groupId
    const searchParams = new URLSearchParams(window.location.search);
    const gId = searchParams.get("groupId");

    if (gId) {
      // 判定這個 gId 是否已經存在於任何一個清單中
      const isMine = localMy.some((t: TripRecord) => t.id === gId);
      const isShared = localShared.some((t: TripRecord) => t.id === gId);

      // 如果兩邊都沒有，這就是一個「全新被分享」的行程
      if (!isMine && !isShared) {
        const newShare = { id: gId, name: "新分享的行程..." };
        const updatedShared = [...localShared, newShare];
        localStorage.setItem("sharedTrips", JSON.stringify(updatedShared));
        setSharedTrips(updatedShared);
      }
      
      // 無論如何，進入該行程的規劃頁
      loadTrip(gId);
    }
  }, []);

  const loadTrip = (gId: string) => {
    setGroupId(gId);
    setView("planner");
    
    // 更新網址導航，確保重整後還是在這
    const newUrl = `${window.location.pathname}?groupId=${gId}`;
    window.history.pushState({ groupId: gId }, "", newUrl);

    // 監聽 Firebase 數據同步
    onSnapshot(doc(db, "groups", gId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentName = data.name || "未命名旅程";
        setGroupName(currentName);
        
        // ✨ 自動同步名稱到本地清單
        syncNameWithLocal(gId, currentName);

        const rawDays = data.days || [];
        setDays(rawDays);
        if (!tripId && rawDays.length > 0) setTripId(rawDays[0].id);
      }
    });
  };

  // 名稱同步功能：確保首頁看到的名稱與資料庫一致
  const syncNameWithLocal = (id: string, name: string) => {
    const mySaved = JSON.parse(localStorage.getItem("myTrips") || "[]");
    const sharedSaved = JSON.parse(localStorage.getItem("sharedTrips") || "[]");

    const myIdx = mySaved.findIndex((t: any) => t.id === id);
    if (myIdx > -1) {
      mySaved[myIdx].name = name;
      localStorage.setItem("myTrips", JSON.stringify(mySaved));
      setMyTrips(mySaved);
    }

    const shareIdx = sharedSaved.findIndex((t: any) => t.id === id);
    if (shareIdx > -1) {
      sharedSaved[shareIdx].name = name;
      localStorage.setItem("sharedTrips", JSON.stringify(sharedSaved));
      setSharedTrips(sharedSaved);
    }
  };

  // 建立新旅程
  const createNewTrip = async () => {
    const gId = "grp_" + Math.random().toString(36).substring(2, 10);
    const tId = "day_" + Math.random().toString(36).substring(2, 10);
    const name = "我的新旅程";
    await setDoc(doc(db, "groups", gId), { name, days: [{ id: tId, label: "第一天" }] });
    
    const saved = JSON.parse(localStorage.getItem("myTrips") || "[]");
    saved.push({ id: gId, name });
    localStorage.setItem("myTrips", JSON.stringify(saved));
    setMyTrips(saved);

    window.location.search = `?groupId=${gId}`;
  };

  // 大廳更名與移除
  const renameTrip = async (id: string, newName: string, listType: "my" | "shared") => {
    const key = listType === "my" ? "myTrips" : "sharedTrips";
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    const updated = list.map((t: any) => t.id === id ? { ...t, name: newName } : t);
    localStorage.setItem(key, JSON.stringify(updated));
    if (listType === "my") setMyTrips(updated); else setSharedTrips(updated);
    await updateDoc(doc(db, "groups", id), { name: newName });
    setDbEditId(null);
  };

  const removeTrip = (id: string, listType: "my" | "shared", e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("從清單移除？(資料庫不會刪除)")) return;
    const key = listType === "my" ? "myTrips" : "sharedTrips";
    const updated = JSON.parse(localStorage.getItem(key) || "[]").filter((t: any) => t.id !== id);
    localStorage.setItem(key, JSON.stringify(updated));
    if (listType === "my") setMyTrips(updated); else setSharedTrips(updated);
  };

  // 行程 Plans 邏輯
  useEffect(() => {
    if (!tripId) return;
    const q = query(collection(db, "trips", tripId, "plans"), orderBy("order", "asc"));
    return onSnapshot(q, (snapshot) => {
      setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Plan[]);
    });
  }, [tripId]);

  const handleAddPlan = async () => {
    if (!title || !tripId) return;
    await addDoc(collection(db, "trips", tripId, "plans"), { title, note, order: plans.length });
    setTitle(""); setNote("");
  };

  // 拖曳與排序 (手機與電腦支援)
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

  // --- 介面渲染 ---
  if (view === "dashboard") {
    return (
      <div style={{ padding: "30px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <h1 style={{ fontWeight: "800", fontSize: "32px", marginBottom: "20px" }}>旅程總覽</h1>
        <button onClick={createNewTrip} style={{ width: "100%", padding: "18px", backgroundColor: "#007AFF", color: "white", borderRadius: "15px", border: "none", fontWeight: "bold", fontSize: "16px", marginBottom: "30px" }}>✨ 建立新旅程</button>

        <h3 style={{ borderBottom: "2px solid #eee", paddingBottom: "10px", marginBottom: "15px" }}>🏠 我建立的行程</h3>
        {myTrips.length === 0 && <p style={{ color: "#999", fontSize: "14px", marginBottom: "20px" }}>目前沒有自建行程</p>}
        {myTrips.map(trip => (
          <div key={trip.id} onClick={() => loadTrip(trip.id)} style={{ padding: "15px", backgroundColor: "#F2F2F7", borderRadius: "12px", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            {dbEditId === trip.id ? (
              <div style={{ flex: 1, display: "flex", gap: "10px" }} onClick={(e) => e.stopPropagation()}>
                <input value={dbEditName} onChange={(e) => setDbEditName(e.target.value)} style={{ flex: 1, padding: "5px" }} />
                <button onClick={() => renameTrip(trip.id, dbEditName, "my")} style={{ background: "#34C759", color: "#fff", border: "none", borderRadius: "5px", padding: "5px 10px" }}>儲存</button>
              </div>
            ) : (
              <>
                <b style={{ flex: 1 }}>{trip.name}</b>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={(e) => { e.stopPropagation(); setDbEditId(trip.id); setDbEditName(trip.name); }} style={{ border: "none", background: "none" }}>📝</button>
                  <button onClick={(e) => removeTrip(trip.id, "my", e)} style={{ border: "none", color: "red", background: "none" }}>🗑️</button>
                </div>
              </>
            )}
          </div>
        ))}

        <h3 style={{ borderBottom: "2px solid #eee", paddingBottom: "10px", marginTop: "30px", color: "#007AFF", marginBottom: "15px" }}>🤝 朋友揪的行程</h3>
        {sharedTrips.length === 0 && <p style={{ color: "#999", fontSize: "14px" }}>點開連結後，行程會自動存放在這裡</p>}
        {sharedTrips.map(trip => (
          <div key={trip.id} onClick={() => loadTrip(trip.id)} style={{ padding: "15px", backgroundColor: "#EEF6FF", borderRadius: "12px", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", border: "1px solid #D6E4FF" }}>
            {dbEditId === trip.id ? (
              <div style={{ flex: 1, display: "flex", gap: "10px" }} onClick={(e) => e.stopPropagation()}>
                <input value={dbEditName} onChange={(e) => setDbEditName(e.target.value)} style={{ flex: 1, padding: "5px" }} />
                <button onClick={() => renameTrip(trip.id, dbEditName, "shared")} style={{ background: "#34C759", color: "#fff", border: "none", borderRadius: "5px", padding: "5px 10px" }}>儲存</button>
              </div>
            ) : (
              <>
                <b style={{ color: "#0056b3", flex: 1 }}>{trip.name}</b>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={(e) => { e.stopPropagation(); setDbEditId(trip.id); setDbEditName(trip.name); }} style={{ border: "none", background: "none" }}>📝</button>
                  <button onClick={(e) => removeTrip(trip.id, "shared", e)} style={{ border: "none", color: "red", background: "none" }}>🗑️</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <button onClick={() => { setView("dashboard"); window.history.pushState(null, "", window.location.pathname); }} style={{ color: "#007AFF", border: "none", background: "none", fontWeight: "bold" }}>❮ 回首頁</button>
        <input value={groupName} onChange={(e) => { setGroupName(e.target.value); updateDoc(doc(db, "groups", groupId!), { name: e.target.value }); }} style={{ fontWeight: "bold", border: "none", textAlign: "right", width: "50%", fontSize: "18px" }} />
      </div>

      <button onClick={() => { 
        const shareUrl = `${window.location.origin}${window.location.pathname}?groupId=${groupId}`;
        navigator.clipboard.writeText(shareUrl); 
        alert("🔗 連結已複製！朋友點開後可一起編輯。"); 
      }} style={{ width: "100%", padding: "12px", backgroundColor: "#34C759", color: "white", borderRadius: "10px", border: "none", fontWeight: "bold", marginBottom: "20px" }}>📢 分享連結 (可共同編輯)</button>

      {/* 天數、新增、拖曳列表... (其餘邏輯保持與上一版相同) */}
      {/* ... [這部分為了節省長度，保持你之前手機拖曳的版本邏輯即可] ... */}
      <div style={{ touchAction: "none" }}>
        {plans.map((plan, index) => (
          <div key={plan.id} data-index={index} draggable onDragStart={() => setDraggedItemIndex(index)} onDrop={() => { reorderPlans(draggedItemIndex!, index); setDraggedItemIndex(null); saveOrderToDb(); }}
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
               style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "15px", marginBottom: "12px", backgroundColor: "#fff", opacity: draggedItemIndex === index ? 0.5 : 1 }}>
            {/* 行程內容與編輯按鈕... */}
            <div style={{ display: "flex", justifyContent: "space-between" }}><b>{plan.title}</b><span>☰</span></div>
            <p style={{ fontSize: "14px" }}>{renderNote(plan.note)}</p>
            <div style={{ display: "flex", gap: "15px", marginTop: "10px" }}>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.title)}`} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "#007AFF" }}>🗺️ 地圖</a>
                <button onClick={() => { setEditingId(plan.id); setEditTitle(plan.title); setEditNote(plan.note); }} style={{ background: "none", border: "none", color: "#007AFF" }}>📝 編輯</button>
                <button onClick={() => deleteDoc(doc(db, "trips", tripId!, "plans", plan.id))} style={{ background: "none", border: "none", color: "red", marginLeft: "auto" }}>🗑️ 刪除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}