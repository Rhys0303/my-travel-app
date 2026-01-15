"use client";
import { useState, useEffect } from "react";
import { db } from "./firebase"; 
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, arrayUnion, arrayRemove, setDoc, getDocs, writeBatch } from "firebase/firestore";

interface Plan {
  id: string;
  title: string;
  date: string;
  note: string;
  order: number; // ✨ 新增：排序權重
}

interface TripRecord {
  id: string;
  name: string;
}

export default function Home() {
  const [view, setView] = useState<"dashboard" | "planner">("dashboard");
  const [myTrips, setMyTrips] = useState<TripRecord[]>([]); // 個人本地紀錄
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [tripId, setTripId] = useState<string | null>(null);
  const [activeTrips, setActiveTrips] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  // 1. 初始化：純個人儀表板邏輯
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const gId = searchParams.get("groupId");
    
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
        setActiveTrips(data.tripIds || []);
        if (!tripId && data.tripIds?.length > 0) setTripId(data.tripIds[0]);
        saveToLocal(gId, data.name || "未命名旅程");
      }
    });
  };

  const saveToLocal = (id: string, name: string) => {
    let saved = JSON.parse(localStorage.getItem("myTrips") || "[]") as TripRecord[];
    if (!saved.find(t => t.id === id)) {
      saved.push({ id, name });
      localStorage.setItem("myTrips", JSON.stringify(saved));
      setMyTrips(saved);
    }
  };

  // 2. 監聽內容並按 order 排序
  useEffect(() => {
    if (!tripId) return;
    const q = query(collection(db, "trips", tripId, "plans"), orderBy("order", "asc"));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Plan[];
      setPlans(list);
    });
  }, [tripId]);

  // ✨ 拖曳排序邏輯 (HTML5 Drag & Drop)
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => setDraggedItemIndex(index);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (index: number) => {
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    
    const newPlans = [...plans];
    const [movedItem] = newPlans.splice(draggedItemIndex, 1);
    newPlans.splice(index, 0, movedItem);

    // 更新資料庫中的 order (資工系做法：使用 Batch 更新優化效能)
    const batch = writeBatch(db);
    newPlans.forEach((plan, i) => {
      const ref = doc(db, "trips", tripId!, "plans", plan.id);
      batch.update(ref, { order: i });
    });
    await batch.commit();
    setDraggedItemIndex(null);
  };

  // ✨ 批量刪除本地紀錄 (去過的全刪)
  const clearAllRecords = () => {
    if (confirm("確定要清空儀表板上所有的旅程紀錄嗎？這不會刪除資料庫，但你會失去捷徑。")) {
      localStorage.removeItem("myTrips");
      setMyTrips([]);
    }
  };

  const createNewTrip = async () => {
    const gId = "grp_" + Math.random().toString(36).substring(2, 10);
    const tId = "day_" + Math.random().toString(36).substring(2, 10);
    await setDoc(doc(db, "groups", gId), { name: "新計畫", tripIds: [tId] });
    window.location.search = `?groupId=${gId}`;
  };

  // --- 視圖 A：個人儀表板 (像 App 的首頁) ---
  if (view === "dashboard") {
    return (
      <div style={{ padding: "30px", maxWidth: "600px", margin: "0 auto", fontFamily: "-apple-system, sans-serif" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "800", marginBottom: "10px" }}>我的旅遊總管</h1>
        <p style={{ color: "#666", marginBottom: "30px" }}>這是你的私人空間，只有你看得到這些紀錄。</p>
        
        <button onClick={createNewTrip} style={{ width: "100%", padding: "18px", backgroundColor: "#007AFF", color: "white", border: "none", borderRadius: "15px", fontWeight: "bold", fontSize: "16px", marginBottom: "40px", boxShadow: "0 4px 15px rgba(0,122,255,0.3)" }}>
          ✨ 建立新旅程
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <h2 style={{ fontSize: "20px" }}>近期行程</h2>
          {myTrips.length > 0 && (
            <button onClick={clearAllRecords} style={{ color: "#FF3B30", border: "none", background: "none", cursor: "pointer", fontSize: "14px" }}>🗑️ 清空紀錄</button>
          )}
        </div>

        {myTrips.map(trip => (
          <div key={trip.id} onClick={() => loadTrip(trip.id)} style={{ padding: "20px", backgroundColor: "#F2F2F7", borderRadius: "18px", marginBottom: "12px", cursor: "pointer", display: "flex", alignItems: "center", transition: "transform 0.2s" }}>
            <span style={{ fontSize: "24px", marginRight: "15px" }}>🌍</span>
            <div>
              <div style={{ fontWeight: "bold", fontSize: "17px" }}>{trip.name}</div>
              <div style={{ fontSize: "12px", color: "#8E8E93" }}>ID: {trip.id}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // --- 視圖 B：行程編輯器 ---
  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "-apple-system, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <button onClick={() => setView("dashboard")} style={{ border: "none", background: "none", color: "#007AFF", fontWeight: "bold" }}>❮ 我的總管</button>
        <input value={groupName} onChange={(e) => { setGroupName(e.target.value); updateDoc(doc(db, "groups", groupId!), { name: e.target.value }); }} 
               style={{ border: "none", textAlign: "right", fontWeight: "bold", fontSize: "18px", width: "50%" }} />
      </div>

      {/* 分頁與新增區 (略，保持原有功能) */}
      <div style={{ backgroundColor: "#F2F2F7", padding: "15px", borderRadius: "15px", marginBottom: "20px" }}>
        <input placeholder="地點" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "10px" }} />
        <textarea placeholder="備註 (支援網址自動轉換)" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ddd", marginBottom: "10px" }} />
        <button onClick={async () => {
          if (!title) return;
          await addDoc(collection(db, "trips", tripId!, "plans"), { title, date, note, order: plans.length, createdAt: new Date() });
          setTitle(""); setNote("");
        }} style={{ width: "100%", padding: "12px", backgroundColor: "#34C759", color: "white", border: "none", borderRadius: "10px", fontWeight: "bold" }}>＋ 加入行程</button>
      </div>

      <p style={{ fontSize: "12px", color: "#888", textAlign: "center", marginBottom: "10px" }}>💡 長按並拖曳卡片可以重新排序行程</p>

      {/* 行程列表 (支援拖曳) */}
      <div onDragOver={handleDragOver}>
        {plans.map((plan, index) => (
          <div 
            key={plan.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDrop={() => handleDrop(index)}
            style={{ 
              border: "1px solid #E5E5EA", borderRadius: "15px", padding: "16px", marginBottom: "12px", 
              backgroundColor: "#fff", cursor: "grab", boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
              opacity: draggedItemIndex === index ? 0.5 : 1
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h3 style={{ margin: "0", fontSize: "18px" }}>{plan.title}</h3>
              <span style={{ color: "#C7C7CC" }}>☰</span>
            </div>
            <p style={{ fontSize: "14px", color: "#48484A", margin: "8px 0" }}>{plan.note}</p>
            <div style={{ display: "flex", gap: "15px", fontSize: "13px", color: "#007AFF" }}>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.title)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>🗺️ 地圖</a>
              <button onClick={() => deleteDoc(doc(db, "trips", tripId!, "plans", plan.id))} style={{ border: "none", background: "none", color: "#FF3B30", cursor: "pointer", marginLeft: "auto" }}>🗑️ 刪除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}