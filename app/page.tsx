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
  // 視圖狀態：dashboard (我的總管), planner (我/死黨編輯), readonly (朋友單日看)
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
    const vTId = searchParams.get("viewTripId");

    // 模式 A：單日唯讀分享 (給路人朋友)
    if (vTId) {
      setTripId(vTId);
      setView("readonly");
      return;
    }

    // 模式 B：個人總管 (載入自己的本地紀錄)
    const saved = JSON.parse(localStorage.getItem("myTrips") || "[]");
    setMyTrips(saved);

    // 模式 C：進入特定旅程房間 (自己或死黨)
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
        
        // 同步更新本地紀錄的名稱
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

  // ✨ 功能：在儀表板修改旅程名稱
  const renameTripInDashboard = async (id: string, newName: string) => {
    // 1. 更新本地列表顯示
    const updatedTrips = myTrips.map(t => t.id === id ? { ...t, name: newName } : t);
    setMyTrips(updatedTrips);
    localStorage.setItem("myTrips", JSON.stringify(updatedTrips));
    
    // 2. 同步更新資料庫 (這樣別人進來也會看到新名字)
    try {
      await updateDoc(doc(db, "groups", id), { name: newName });
    } catch (e) {
      console.error("更新名稱失敗", e);
    }
  };

  // ✨ 功能：在儀表板刪除單一旅程 (僅移除紀錄)
  const removeTripFromDashboard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("確定要從列表中移除這個旅程嗎？(資料庫資料會保留，但你會看不到它，除非有點連結)")) {
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

  // --- 視圖 A：個人總管 (Dashboard) ---
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
        }} style={{ width: "100%", padding: "18px", backgroundColor: "#007AFF", color: "white", borderRadius: "15px", border: "none", fontWeight: "bold", fontSize: "16px", marginBottom: "30px", boxShadow: "0 4px 12px rgba(0,122,255,0.3)" }}>
          ✨ 建立新旅程
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <h2 style={{ fontSize: "18px" }}>我的旅程列表</h2>
        </div>

        {myTrips.length === 0 && <p style={{ color: "#aaa", textAlign: "center", marginTop: "40px" }}>目前沒有旅程紀錄</p>}

        {myTrips.map(trip => (
          <div key={trip.id} onClick={() => loadTrip(trip.id)} style={{ padding: "15px 20px", backgroundColor: "#F2F2F7", borderRadius: "15px", marginBottom: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <span style={{ fontSize: "24px", marginRight: "15px" }}>🌍</span>
              <div style={{ flex: 1 }}>
                {/* ✨ 這裡可以直接改名！ */}
                <input 
                  value={trip.name} 
                  onClick={(e) => e.stopPropagation()} // 防止點擊輸入框時觸發跳轉
                  onChange={(e) => renameTripInDashboard(trip.id, e.target.value)}
                  style={{ 
                    border: "none", background: "transparent", fontWeight: "bold", fontSize: "17px", width: "100%", 
                    textOverflow: "ellipsis", padding: "5px 0" 
                  }}
                />
                <div style={{ fontSize: "12px", color: "#8E8E93" }}>ID: {trip.id}</div>
              </div>
            </div>
            
            {/* ✨ 單筆刪除按鈕 */}
            <button 
              onClick={(e) => removeTripFromDashboard(trip.id, e)}
              style={{ border: "none", background: "#fff", color: "#FF3B30", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 5px rgba(0,0,0,0.1)", marginLeft: "10px" }}
            >
              🗑️
            </button>
          </div>
        ))}

        {myTrips.length > 0 && (
          <button onClick={() => { if(confirm("確定清空所有紀錄？")) { localStorage.removeItem("myTrips"); setMyTrips([]); } }} style={{ marginTop: "20px", width: "100%", padding: "12px", color: "#999", border: "1px dashed #ddd", background: "none", borderRadius: "10px" }}>
            清空所有本地紀錄
          </button>
        )}
      </div>
    );
  }

  // --- 視圖 B & C：規劃頁與唯讀頁 ---
  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      {view !== "readonly" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <button onClick={() => { setView("dashboard"); window.history.replaceState(null, "", window.location.pathname); }} style={{ color: "#007AFF", border: "none", background: "none", fontWeight: "bold", fontSize: "16px" }}>❮ 回總管</button>
          <input value={groupName} onChange={(e) => { setGroupName(e.target.value); updateDoc(doc(db, "groups", groupId!), { name: e.target.value }); saveToLocal(groupId!, e.target.value); }} 
                 style={{ fontWeight: "bold", border: "none", textAlign: "right", fontSize: "18px", width: "50%" }} />
        </div>
      )}

      {view === "readonly" && (
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h2 style={{ margin: 0 }}>📍 行程分享</h2>
          <p style={{ color: "#666", fontSize: "14px" }}>這是朋友與你分享的單日規劃</p>
        </div>
      )}

      {/* 分享按鈕區 */}
      {view === "planner" && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert("🔗 已複製：完整旅程連結"); }}
                  style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", backgroundColor: "#34C759", color: "white", fontWeight: "bold", fontSize: "13px" }}>
            📢 分享全部
          </button>
          <button onClick={() => { 
            const baseUrl = window.location.origin + window.location.pathname;
            navigator.clipboard.writeText(`${baseUrl}?viewTripId=${tripId}`); 
            alert("🎯 已複製：此分頁唯讀連結"); 
          }}
                  style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", backgroundColor: "#5856D6", color: "white", fontWeight: "bold", fontSize: "13px" }}>
            🎯 僅分享今天
          </button>
        </div>
      )}

      {/* 天數切換 (支援改名與刪除) */}
      {view === "planner" && (
        <div style={{ display: "flex", gap: "5px", overflowX: "auto", marginBottom: "20px", paddingBottom: "5px", borderBottom: "1px solid #eee" }}>
          {days.map((day) => (
            <div key={day.id} onClick={() => setTripId(day.id)} style={{
              padding: "10px 15px", borderRadius: "10px 10px 0 0", cursor: "pointer", whiteSpace: "nowrap",
              backgroundColor: tripId === day.id ? "#007AFF" : "#eee", color: tripId === day.id ? "white" : "#666",
              display: "flex", alignItems: "center", gap: "8px", border: "1px solid #ddd", borderBottom: "none"
            }}>
              {/* ✨ 內部分頁改名 */}
              <input value={day.label} onChange={(e) => {
                const updated = days.map(d => d.id === day.id ? { ...d, label: e.target.value } : d);
                setDays(updated);
                updateDoc(doc(db, "groups", groupId!), { days: updated });
              }} style={{ background: "none", border: "none", color: "inherit", width: "70px", fontSize: "14px", textAlign: "center" }} />
              
              {/* ✨ 內部分頁刪除 */}
              <span onClick={async (e) => {
                e.stopPropagation();
                if (days.length <= 1) return;
                if (confirm("刪除此天？")) {
                  const updated = days.filter(d => d.id !== day.id);
                  await updateDoc(doc(db, "groups", groupId!), { days: updated });
                  if (tripId === day.id) setTripId(updated[0].id);
                }
              }} style={{ fontSize: "12px", opacity: 0.7 }}>✕</span>
            </div>
          ))}
          <button onClick={() => {
            const newId = "day_" + Math.random().toString(36).substring(2, 10);
            updateDoc(doc(db, "groups", groupId!), { days: [...days, { id: newId, label: `Day ${days.length + 1}` }] });
            setTripId(newId);
          }} style={{ padding: "10px", color: "#007AFF", border: "none", background: "none", fontWeight: "bold" }}>＋天數</button>
        </div>
      )}

      {/* 輸入區 */}
      {view === "planner" && (
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
          <div key={plan.id} draggable={view === "planner"} onDragStart={() => setDraggedItemIndex(index)} onDrop={() => handleDrop(index)}
            style={{ border: "1px solid #ddd", borderRadius: "15px", padding: "15px", marginBottom: "12px", backgroundColor: "#fff", opacity: draggedItemIndex === index ? 0.5 : 1, cursor: view === "planner" ? "grab" : "default" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px" }}>{plan.title}</h3>
              {view === "planner" && <span style={{ color: "#ccc" }}>☰</span>}
            </div>
            {plan.note && <p style={{ fontSize: "15px", margin: "10px 0", color: "#444", whiteSpace: "pre-wrap" }}>💡 {renderNote(plan.note)}</p>}
            <div style={{ display: "flex", gap: "15px", marginTop: "10px", borderTop: "1px solid #f9f9f9", paddingTop: "10px" }}>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.title)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "#007AFF", fontSize: "14px", fontWeight: "bold" }}>🗺️ 地圖</a>
              {view === "planner" && (
                <button onClick={() => deleteDoc(doc(db, "trips", tripId!, "plans", plan.id))} style={{ color: "#FF3B30", border: "none", background: "none", marginLeft: "auto", cursor: "pointer", fontSize: "14px" }}>🗑️ 刪除</button>
              )}
            </div>
          </div>
        ))}
        {plans.length === 0 && <p style={{ textAlign: "center", color: "#999", padding: "40px 0" }}>尚未新增任何行程內容</p>}
      </div>
    </div>
  );
}