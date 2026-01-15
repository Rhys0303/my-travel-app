"use client";
import { useState, useEffect } from "react";
import { db } from "./firebase"; 
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, updateDoc, arrayUnion, arrayRemove, setDoc, getDoc } from "firebase/firestore";

interface Plan {
  id: string;
  title: string;
  date: string;
  note: string;
}

interface GroupInfo {
  id: string;
  name: string;
}

export default function Home() {
  const [view, setView] = useState<"lobby" | "apartment">("lobby"); // 切換大廳或房間
  const [myApartments, setMyApartments] = useState<GroupInfo[]>([]); // 記錄我的公寓清單
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState(""); // 公寓門牌
  const [tripId, setTripId] = useState<string | null>(null);
  const [activeTrips, setActiveTrips] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");

  // 1. 初始化：檢查網址或載入大廳
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const gId = searchParams.get("groupId");
    
    // 載入本地儲存的公寓清單
    const saved = JSON.parse(localStorage.getItem("myApartments") || "[]");
    setMyApartments(saved);

    if (gId) {
      enterApartment(gId);
    }
  }, []);

  // 進入特定公寓
  const enterApartment = async (gId: string) => {
    setGroupId(gId);
    setView("apartment");
    const newUrl = `${window.location.pathname}?groupId=${gId}`;
    window.history.replaceState(null, "", newUrl);

    // 監聽公寓資訊 (門牌與天數)
    onSnapshot(doc(db, "groups", gId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGroupName(data.name || "未命名旅程");
        const ids = data.tripIds || [];
        setActiveTrips(ids);
        if (ids.length > 0 && (!tripId || !ids.includes(tripId))) {
          setTripId(ids[0]);
        }

        // 更新本地清單的名稱
        updateLocalList(gId, data.name || "未命名旅程");
      }
    });
  };

  // 更新本地快取清單
  const updateLocalList = (id: string, name: string) => {
    const saved = JSON.parse(localStorage.getItem("myApartments") || "[]") as GroupInfo[];
    const index = saved.findIndex(item => item.id === id);
    if (index > -1) {
      saved[index].name = name;
    } else {
      saved.push({ id, name });
    }
    localStorage.setItem("myApartments", JSON.stringify(saved));
    setMyApartments(saved);
  };

  // 建立新公寓 (新旅程)
  const createNewApartment = async () => {
    const gId = "group_" + Math.random().toString(36).substring(2, 10);
    const firstTripId = Math.random().toString(36).substring(2, 10);
    const defaultName = "我的新旅程";
    
    await setDoc(doc(db, "groups", gId), {
      name: defaultName,
      tripIds: [firstTripId]
    });
    
    enterApartment(gId);
  };

  // 修改門牌名稱
  const handleUpdateGroupName = async (newName: string) => {
    if (!groupId) return;
    setGroupName(newName);
    await updateDoc(doc(db, "groups", groupId), { name: newName });
  };

  // 監聽行程內容 (原有邏輯)
  useEffect(() => {
    if (!tripId) return;
    const q = query(collection(db, "trips", tripId, "plans"), orderBy("date", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Plan[];
      setPlans(list);
    });
    return () => unsubscribe();
  }, [tripId]);

  // 備註自動連結工具
  const renderNote = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => 
      urlRegex.test(part) ? (
        <a key={i} href={part} target="_blank" rel="noreferrer" style={{ color: "#0070f3", wordBreak: "break-all" }}>{part}</a>
      ) : part
    );
  };

  // --- 大廳畫面 ---
  if (view === "lobby") {
    return (
      <div style={{ padding: "40px 20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
        <h1 style={{ textAlign: "center", marginBottom: "40px" }}>🏢 旅遊公寓大廳</h1>
        <button onClick={createNewApartment} style={{ width: "100%", padding: "20px", fontSize: "18px", backgroundColor: "#0070f3", color: "white", border: "none", borderRadius: "12px", fontWeight: "bold", cursor: "pointer", marginBottom: "30px" }}>
          ＋ 建立新的旅程房間
        </button>
        
        <h3>我的房間清單：</h3>
        {myApartments.length === 0 && <p style={{ color: "#888" }}>目前沒有紀錄，建立一個新旅程或點擊別人的連結進入吧！</p>}
        {myApartments.map(apt => (
          <div key={apt.id} onClick={() => enterApartment(apt.id)} style={{ padding: "20px", backgroundColor: "#fff", border: "1px solid #ddd", borderRadius: "12px", marginBottom: "10px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: "bold" }}>📍 {apt.name}</span>
            <span style={{ fontSize: "12px", color: "#aaa" }}>ID: {apt.id.substring(6)} 〉</span>
          </div>
        ))}
      </div>
    );
  }

  // --- 公寓房間畫面 (原本的介面加強版) ---
  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <button onClick={() => { setView("lobby"); window.history.replaceState(null, "", window.location.pathname); }} style={{ background: "none", border: "none", color: "#0070f3", cursor: "pointer" }}>❮ 回大廳</button>
        <input 
          value={groupName} 
          onChange={(e) => handleUpdateGroupName(e.target.value)} 
          style={{ fontSize: "20px", fontWeight: "bold", border: "none", borderBottom: "2px solid #eee", textAlign: "right", width: "60%" }}
          placeholder="點擊設定旅程名稱"
        />
      </div>

      <div style={{ display: "flex", gap: "5px", overflowX: "auto", marginBottom: "15px", borderBottom: "2px solid #eee" }}>
        {activeTrips.map((id, index) => (
          <div key={id} onClick={() => setTripId(id)}
            style={{ padding: "10px 15px", cursor: "pointer", borderRadius: "10px 10px 0 0", backgroundColor: tripId === id ? "#0070f3" : "#f0f0f0", color: tripId === id ? "white" : "#666", display: "flex", alignItems: "center", gap: "8px", border: "1px solid #ddd", borderBottom: "none", whiteSpace: "nowrap" }}>
            Day {index + 1}
            <span onClick={(e) => { e.stopPropagation(); updateDoc(doc(db, "groups", groupId!), { tripIds: arrayRemove(id) }); }} style={{ fontSize: "14px", opacity: 0.7 }}>✕</span>
          </div>
        ))}
        <button onClick={() => updateDoc(doc(db, "groups", groupId!), { tripIds: arrayUnion(Math.random().toString(36).substring(2, 10)) })} style={{ padding: "10px", border: "none", background: "none", color: "#0070f3", cursor: "pointer", fontWeight: "bold" }}>＋新增天數</button>
      </div>

      <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert("連結已複製！"); }} 
              style={{ width: "100%", padding: "12px", marginBottom: "20px", borderRadius: "8px", border: "none", backgroundColor: "#34c759", color: "white", fontWeight: "bold", cursor: "pointer" }}>
        📢 分享這間公寓的鑰匙 (連結)
      </button>

      {/* 輸入區 */}
      <div style={{ backgroundColor: "#f9f9f9", padding: "20px", borderRadius: "12px", marginBottom: "30px", border: "1px solid #eee" }}>
        <input placeholder="要去哪裡？" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
        <textarea placeholder="備註" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
        <button onClick={async () => {
          if (!title || !tripId) return alert("請輸入地點！");
          await addDoc(collection(db, "trips", tripId, "plans"), { title, date, note, createdAt: new Date() });
          setTitle(""); setDate(""); setNote("");
        }} style={{ width: "100%", padding: "12px", backgroundColor: "#0070f3", color: "white", borderRadius: "8px", border: "none", fontWeight: "bold" }}>➕ 加入行程</button>
      </div>

      {/* 行程列表 (包含編輯功能) */}
      <div>
        {plans.map((plan) => (
          <div key={plan.id} style={{ border: "1px solid #eee", borderRadius: "12px", padding: "16px", marginBottom: "12px", backgroundColor: "#fff" }}>
            {editingId === plan.id ? (
              <div>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: "100%", marginBottom: "5px" }} />
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={{ width: "100%", marginBottom: "5px" }} />
                <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} style={{ width: "100%", marginBottom: "10px" }} />
                <button onClick={async () => { await updateDoc(doc(db, "trips", tripId!, "plans", plan.id), { title: editTitle, date: editDate, note: editNote }); setEditingId(null); }} style={{ marginRight: "10px", backgroundColor: "#34c759", color: "white", padding: "5px 10px", borderRadius: "5px", border: "none" }}>儲存</button>
                <button onClick={() => setEditingId(null)} style={{ backgroundColor: "#888", color: "#fff", padding: "5px 10px", borderRadius: "5px", border: "none" }}>取消</button>
              </div>
            ) : (
              <div>
                <h3 style={{ margin: "0" }}>{plan.title}</h3>
                <p style={{ fontSize: "14px", color: "#666" }}>📅 {plan.date || "未定"}</p>
                <p style={{ fontSize: "15px", color: "#444", whiteSpace: "pre-wrap" }}>💡 {renderNote(plan.note)}</p>
                <div style={{ marginTop: "10px", display: "flex", gap: "15px", borderTop: "1px solid #eee", paddingTop: "10px" }}>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.title)}`} target="_blank" rel="noreferrer" style={{ color: "#0070f3", textDecoration: "none", fontSize: "14px", fontWeight: "bold" }}>🗺️ 在地圖查看</a>
                  <button onClick={() => { setEditingId(plan.id); setEditTitle(plan.title); setEditDate(plan.date); setEditNote(plan.note); }} style={{ background: "none", border: "none", color: "#0070f3", fontSize: "14px" }}>📝 編輯</button>
                  <button onClick={() => deleteDoc(doc(db, "trips", tripId!, "plans", plan.id))} style={{ marginLeft: "auto", color: "#ff4d4f", background: "none", border: "none", fontSize: "14px" }}>🗑️ 刪除</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}