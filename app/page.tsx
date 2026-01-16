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
  const [tripId, setTripId] = useState<string | null>(null); // 當前的天數 ID
  const [days, setDays] = useState<TripDay[]>([]); 

  // 首頁更名狀態 (保留)
  const [dbEditId, setDbEditId] = useState<string | null>(null);
  const [dbEditName, setDbEditName] = useState("");

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const touchDragItem = useRef<number | null>(null);

  // 1. 初始化與清單分流
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

    // 監聽群組資訊（天數與名字）
    return onSnapshot(doc(db, "groups", gId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentName = data.name || "未命名旅程";
        setGroupName(currentName);
        syncNameWithLocal(gId, currentName);

        const rawDays = data.days || [];
        setDays(rawDays);
        
        // ✨ 重要修正：確保 tripId 始終與當前選中的天數 ID 保持同步
        if (rawDays.length > 0) {
          setTripId(prev => {
            // 如果沒選過，預設第一天；如果選過的天數還在，保持不變
            if (!prev) return rawDays[0].id;
            const exists = rawDays.find((d: any) => d.id === prev);
            return exists ? prev : rawDays[0].id;
          });
        }
      }
    });
  };

  const syncNameWithLocal = (id: string, name: string) => {
    const mySaved = JSON.parse(localStorage.getItem("myTrips") || "[]");
    const sharedSaved = JSON.parse(localStorage.getItem("sharedTrips") || "[]");
    const update = (list: any[]) => list.map(t => t.id === id ? { ...t, name } : t);
    
    if (mySaved.some((t: any) => t.id === id)) {
      const newList = update(mySaved);
      localStorage.setItem("myTrips", JSON.stringify(newList));
      setMyTrips(newList);
    }
    if (sharedSaved.some((t: any) => t.id === id)) {
      const newList = update(sharedSaved);
      localStorage.setItem("sharedTrips", JSON.stringify(newList));
      setSharedTrips(newList);
    }
  };

  const renameTripInDashboard = async (id: string, newName: string, listType: "my" | "shared") => {
    const key = listType === "my" ? "myTrips" : "sharedTrips";
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    const updated = list.map((t: TripRecord) => t.id === id ? { ...t, name: newName } : t);
    localStorage.setItem(key, JSON.stringify(updated));
    if (listType === "my") setMyTrips(updated); else setSharedTrips(updated);
    await updateDoc(doc(db, "groups", id), { name: newName });
    setDbEditId(null);
  };

  const removeTrip = (id: string, listType: "my" | "shared", e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("確定移除清單？")) return;
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

  // 2. ✨ 行程即時同步：只要 tripId 變動，立刻監聽新的資料路徑
  useEffect(() => {
    if (!tripId) return;
    const q = query(collection(db, "trips", tripId, "plans"), orderBy("order", "asc"));
    const unsubPlans = onSnapshot(q, (snapshot) => {
      setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Plan[]);
    });
    return () => unsubPlans(); // 清除舊監聽
  }, [tripId]);

  // 3. ✨ 新增行程修復：強制確認 tripId 已經載入
  const handleAddPlan = async () => {
    if (!title) return alert("請輸入地點");
    if (!tripId) return alert("行程同步中，請稍候..."); // 防止存到空 ID

    try {
      await addDoc(collection(db, "trips", tripId, "plans"), { 
        title, 
        note, 
        order: plans.length,
        createdAt: new Date()
      });
      setTitle(""); setNote("");
    } catch (e) {
      console.error(e);
      alert("新增失敗，請檢查網路連線");
    }
  };

  const saveEdit = async (id: string) => {
    await updateDoc(doc(db, "trips", tripId!, "plans", id), { title: editTitle, note: editNote });
    setEditingId(null);
  };

  // --- 手機與電腦拖曳邏輯 (保持原本功能) ---
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

  const handleTouchStart = (index: number) => {
    if (editingId !== null) return;
    touchDragItem.current = index;
    setDraggedItemIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchDragItem.current === null) return;
    const touch = e.touches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetCard = targetElement?.closest('[data-index]');
    if (targetCard) {
      const targetIndex = parseInt(targetCard.getAttribute('data-index')!);
      if (targetIndex !== touchDragItem.current) {
        reorderPlans(touchDragItem.current, targetIndex);
        touchDragItem.current = targetIndex;
        setDraggedItemIndex(targetIndex);
      }
    }
  };

  const handleTouchEnd = () => {
    touchDragItem.current = null;
    setDraggedItemIndex(null);
    saveOrderToDb();
  };

  const renderNote = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => urlRegex.test(part) ? <a key={i} href={part} target="_blank" rel="noreferrer" style={{ color: "#007AFF" }}>{part}</a> : part);
  };

  // --- 介面渲染 ---
  if (view === "dashboard") {
    return (
      <div style={{ padding: "30px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <h1 style={{ fontWeight: "800", fontSize: "32px" }}>旅遊總管</h1>
        <button onClick={createNewTrip} style={{ width: "100%", padding: "15px", backgroundColor: "#007AFF", color: "white", borderRadius: "12px", border: "none", fontWeight: "bold", margin: "20px 0" }}>✨ 建立新旅程</button>

        <h3>🏠 我建立的行程</h3>
        {myTrips.map(trip => (
          <div key={trip.id} onClick={() => loadTrip(trip.id)} style={{ padding: "15px", backgroundColor: "#F2F2F7", borderRadius: "12px", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            {dbEditId === trip.id ? (
              <div style={{ flex: 1, display: "flex", gap: "10px" }} onClick={(e) => e.stopPropagation()}>
                <input value={dbEditName} onChange={(e) => setDbEditName(e.target.value)} style={{ flex: 1, padding: "5px" }} />
                <button onClick={() => renameTripInDashboard(trip.id, dbEditName, "my")} style={{ background: "#34C759", color: "#fff", border: "none", borderRadius: "5px", padding: "5px 10px" }}>儲存</button>
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

        <h3 style={{ marginTop: "30px", color: "#007AFF" }}>🤝 朋友分享的行程</h3>
        {sharedTrips.map(trip => (
          <div key={trip.id} onClick={() => loadTrip(trip.id)} style={{ padding: "15px", backgroundColor: "#EEF6FF", borderRadius: "12px", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #D6E4FF", cursor: "pointer" }}>
            {dbEditId === trip.id ? (
              <div style={{ flex: 1, display: "flex", gap: "10px" }} onClick={(e) => e.stopPropagation()}>
                <input value={dbEditName} onChange={(e) => setDbEditName(e.target.value)} style={{ flex: 1, padding: "5px" }} />
                <button onClick={() => renameTripInDashboard(trip.id, dbEditName, "shared")} style={{ background: "#34C759", color: "#fff", border: "none", borderRadius: "5px", padding: "5px 10px" }}>儲存</button>
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
        <button onClick={() => { setView("dashboard"); window.history.pushState(null, "", window.location.pathname); }} style={{ color: "#007AFF", border: "none", background: "none", fontWeight: "bold" }}>❮ 回總管</button>
        <input value={groupName} onChange={(e) => { setGroupName(e.target.value); updateDoc(doc(db, "groups", groupId!), { name: e.target.value }); }} style={{ fontWeight: "bold", border: "none", textAlign: "right", width: "50%", fontSize: "18px" }} />
      </div>

      <button onClick={() => { 
        const shareUrl = `${window.location.origin}${window.location.pathname}?groupId=${groupId}`;
        navigator.clipboard.writeText(shareUrl); 
        alert("✅ 連結已複製！發送後對方點開可一起編輯。"); 
      }} style={{ width: "100%", padding: "12px", backgroundColor: "#34C759", color: "white", borderRadius: "10px", border: "none", fontWeight: "bold", marginBottom: "20px" }}>📢 分享連結</button>

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
          setTripId(newId);
        }} style={{ border: "none", background: "none", color: "#007AFF", fontWeight: "bold" }}>＋天數</button>
      </div>

      <div style={{ backgroundColor: "#F2F2F7", padding: "15px", borderRadius: "15px", marginBottom: "20px" }}>
        <input placeholder="地點" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "10px" }} />
        <textarea placeholder="備註" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", marginBottom: "10px" }} />
        <button onClick={handleAddPlan} style={{ width: "100%", padding: "10px", backgroundColor: "#007AFF", color: "white", borderRadius: "8px", border: "none", fontWeight: "bold" }}>➕ 加入行程</button>
      </div>

      <div style={{ touchAction: "none" }}>
        {plans.map((plan, index) => (
          <div key={plan.id} data-index={index} draggable onDragStart={() => setDraggedItemIndex(index)} 
               onDrop={() => { reorderPlans(draggedItemIndex!, index); setDraggedItemIndex(null); saveOrderToDb(); }}
               onDragOver={(e) => e.preventDefault()}
               onTouchStart={() => handleTouchStart(index)} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
               style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "15px", marginBottom: "12px", backgroundColor: "#fff", opacity: draggedItemIndex === index ? 0.5 : 1 }}>
            {editingId === plan.id ? (
              <div onTouchStart={(e) => e.stopPropagation()}>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: "100%", marginBottom: "5px", padding: "5px" }} />
                <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} style={{ width: "100%", marginBottom: "10px", padding: "5px" }} />
                <button onClick={() => saveEdit(plan.id)} style={{ backgroundColor: "#34C759", color: "white", padding: "5px 15px", borderRadius: "5px", border: "none" }}>儲存</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between" }}><b>{plan.title}</b><span style={{ color: "#ccc" }}>☰</span></div>
                <p style={{ fontSize: "14px", color: "#444" }}>{renderNote(plan.note)}</p>
                <div style={{ display: "flex", gap: "15px", marginTop: "10px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.title)}`} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "#007AFF", fontWeight: "bold" }} onTouchStart={(e) => e.stopPropagation()}>🗺️ 地圖</a>
                  <button onClick={() => { setEditingId(plan.id); setEditTitle(plan.title); setEditNote(plan.note); }} style={{ background: "none", border: "none", color: "#007AFF", fontSize: "12px", fontWeight: "bold" }} onTouchStart={(e) => e.stopPropagation()}>📝 編輯</button>
                  <button onClick={() => deleteDoc(doc(db, "trips", tripId!, "plans", plan.id))} style={{ background: "none", border: "none", color: "red", fontSize: "12px", marginLeft: "auto", fontWeight: "bold" }} onTouchStart={(e) => e.stopPropagation()}>🗑️ 刪除</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}