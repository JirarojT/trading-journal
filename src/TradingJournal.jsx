import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, TrendingUp, TrendingDown, Activity, Brain, AlertCircle, CheckCircle, FileSpreadsheet, Calculator, DollarSign, Edit2, Check, Cloud, CloudOff, Loader2, Calendar, Filter, X, Target, Crosshair } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAF_mS9VByDBtJWwEy6Ok4vThGMykArWiI",
  authDomain: "my-trading-journal-5c8fd.firebaseapp.com",
  projectId: "my-trading-journal-5c8fd",
  storageBucket: "my-trading-journal-5c8fd.firebasestorage.app",
  messagingSenderId: "646393431432",
  appId: "1:646393431432:web:5b64ee2451cf43db7ea63d",
  measurementId: "G-GYZRY0CDG7"
};

// Initialize Firebase
let db, auth;
try {
  if (firebaseConfig) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (error) {
  console.error("Firebase Init Error:", error);
}

const appId = 'my-trading-journal-app'; 
const SHARED_USER_ID = 'main_portfolio_v1';

const TradingJournal = () => {
  const [user, setUser] = useState(null);
  const [isCloudEnabled, setIsCloudEnabled] = useState(!!firebaseConfig);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Balance State
  const [initialBalance, setInitialBalance] = useState(1000);
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [tempBalance, setTempBalance] = useState(initialBalance);

  // Form & UI State
  const [showForm, setShowForm] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  // --- MM Calculator State (Points Based) ---
  const [showMM, setShowMM] = useState(false);
  const [mmData, setMmData] = useState({
    balance: 1000,
    riskPercent: 1, 
    slPoints: 500, // Default 500 points
    tpPoints: 1000 // Default 1000 points
  });
  const [mmResults, setMmResults] = useState({
    riskAmount: 0,
    positionSize: 0,
    rr: 0,
    profitAmount: 0
  });

  // --- History Filter State ---
  const [filterType, setFilterType] = useState('all'); 
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    pair: '',
    direction: 'Long',
    entryPrice: '',
    exitPrice: '',
    positionSize: '', 
    calculatedPnL: 0, 
    result: 'Pending',
    entryReason: '',
    emotionPre: 'Neutral',
    confidence: 5,
    followedPlan: true,
    mistake: 'None',
    notes: ''
  });

  // --- 1. Authentication & Setup ---
  useEffect(() => {
    if (!isCloudEnabled) {
      const saved = localStorage.getItem('trading_mindfulness_journal');
      if (saved) setEntries(JSON.parse(saved));
      const savedBal = localStorage.getItem('trading_journal_balance');
      if (savedBal) setInitialBalance(parseFloat(savedBal));
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
        setLoading(false);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, [isCloudEnabled]);

  // --- 2. Data Sync ---
  useEffect(() => {
    if (!user || !isCloudEnabled) return;

    const q = query(
      collection(db, 'artifacts', appId, 'users', SHARED_USER_ID, 'journal_entries'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeEntries = onSnapshot(q, (snapshot) => {
      const loadedEntries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEntries(loadedEntries);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching entries:", error);
      setLoading(false);
    });

    const balanceDocRef = doc(db, 'artifacts', appId, 'users', SHARED_USER_ID, 'settings', 'balance');
    const unsubscribeBalance = onSnapshot(balanceDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setInitialBalance(docSnap.data().amount);
        setTempBalance(docSnap.data().amount);
      }
    });

    return () => {
      unsubscribeEntries();
      unsubscribeBalance();
    };
  }, [user, isCloudEnabled]);

  // --- MM Calculator Logic (Points Based - Real Time) ---
  useEffect(() => {
    const bal = parseFloat(mmData.balance) || 0;
    const risk = parseFloat(mmData.riskPercent) || 0;
    const slPts = parseFloat(mmData.slPoints) || 0;
    const tpPts = parseFloat(mmData.tpPoints) || 0;

    if (slPts > 0) {
        const riskAmt = (bal * risk) / 100;
        
        // Formula: Lot = Risk ($) / SL (Points)
        // (Assuming Standard Lot where 1 Point = $1 per 1.0 Lot, e.g., Gold/Forex Standard)
        const size = riskAmt / slPts;
        
        let rrRatio = 0;
        let profitAmt = 0;

        if (tpPts > 0) {
            rrRatio = tpPts / slPts;
            profitAmt = size * tpPts; // Profit = Lot * Points
        }

        setMmResults({
            riskAmount: riskAmt,
            positionSize: size,
            rr: rrRatio,
            profitAmount: profitAmt
        });
    } else {
        setMmResults({ riskAmount: 0, positionSize: 0, rr: 0, profitAmount: 0 });
    }
  }, [mmData]); // Updates automatically whenever inputs change

  const openMMCalculator = () => {
    const totalPnL = entries.reduce((acc, curr) => acc + parseFloat(curr.calculatedPnL || 0), 0);
    const currentBal = initialBalance + totalPnL;
    setMmData(prev => ({ ...prev, balance: currentBal }));
    setShowMM(true);
  };

  const applySizeToForm = () => {
      setFormData(prev => ({
          ...prev,
          positionSize: parseFloat(mmResults.positionSize.toFixed(2)) // 2 decimals for Lots
      }));
      setShowMM(false);
      setShowForm(true);
  };


  // --- Filter Logic ---
  const getFilteredEntries = () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    return entries.filter(entry => {
      const entryDate = new Date(entry.date);
      const entryDateStr = entry.date; 

      if (filterType === 'all') return true;
      if (filterType === 'today') return entryDateStr === todayStr;
      
      if (filterType === 'week') {
        const firstDay = new Date(now.setDate(now.getDate() - now.getDay())); 
        const lastDay = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        return entryDate >= firstDay && entryDate <= lastDay;
      }

      if (filterType === 'month') {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
      }

      if (filterType === 'year') {
        const currentYear = new Date().getFullYear();
        return entryDate.getFullYear() === currentYear;
      }

      if (filterType === 'custom') {
        return entryDateStr >= customStartDate && entryDateStr <= customEndDate;
      }

      return true;
    });
  };

  const filteredEntries = getFilteredEntries();
  const filteredPnL = filteredEntries.reduce((acc, curr) => acc + parseFloat(curr.calculatedPnL || 0), 0);
  const filteredWins = filteredEntries.filter(e => e.result === 'Win').length;
  const filteredTotal = filteredEntries.length;
  const filteredWinRate = filteredTotal > 0 ? ((filteredWins / filteredTotal) * 100).toFixed(0) : 0;

  // --- Logic & Handlers ---
  useEffect(() => {
    const entry = parseFloat(formData.entryPrice);
    const exit = parseFloat(formData.exitPrice);
    const size = parseFloat(formData.positionSize);

    if (!isNaN(entry) && !isNaN(exit) && !isNaN(size)) {
      let pnl = 0;
      if (formData.direction === 'Long') {
        pnl = (exit - entry) * size;
      } else {
        pnl = (entry - exit) * size;
      }
      setFormData(prev => ({ ...prev, calculatedPnL: pnl.toFixed(2) }));
    }
  }, [formData.entryPrice, formData.exitPrice, formData.positionSize, formData.direction]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let finalResult = formData.result;
    if(formData.result === 'Pending' && formData.exitPrice) {
        if(parseFloat(formData.calculatedPnL) > 0) finalResult = 'Win';
        else if(parseFloat(formData.calculatedPnL) < 0) finalResult = 'Loss';
        else finalResult = 'BE';
    }

    const newEntry = {
      ...formData,
      result: finalResult,
      createdAt: serverTimestamp()
    };

    try {
      if (isCloudEnabled && user) {
        await addDoc(collection(db, 'artifacts', appId, 'users', SHARED_USER_ID, 'journal_entries'), newEntry);
      } else {
        const localEntry = { ...newEntry, id: Date.now().toString(), createdAt: new Date().toISOString() };
        const updatedEntries = [localEntry, ...entries];
        setEntries(updatedEntries);
        localStorage.setItem('trading_mindfulness_journal', JSON.stringify(updatedEntries));
      }
      setShowForm(false);
      resetForm();
    } catch (error) {
      alert("บันทึกข้อมูลไม่สำเร็จ: " + error.message);
    }
  };

  const deleteEntry = async (id) => {
    if(!confirm('ลบรายการนี้?')) return;

    if (isCloudEnabled && user) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', SHARED_USER_ID, 'journal_entries', id));
    } else {
      const updatedEntries = entries.filter(e => e.id !== id);
      setEntries(updatedEntries);
      localStorage.setItem('trading_mindfulness_journal', JSON.stringify(updatedEntries));
    }
  };

  const saveBalance = async () => {
    const newAmount = parseFloat(tempBalance);
    setInitialBalance(newAmount);
    setIsEditingBalance(false);

    if (isCloudEnabled && user) {
       await setDoc(doc(db, 'artifacts', appId, 'users', SHARED_USER_ID, 'settings', 'balance'), {
         amount: newAmount
       });
    } else {
       localStorage.setItem('trading_journal_balance', newAmount.toString());
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      pair: '',
      direction: 'Long',
      entryPrice: '',
      exitPrice: '',
      positionSize: '',
      calculatedPnL: 0,
      result: 'Pending',
      entryReason: '',
      emotionPre: 'Neutral',
      confidence: 5,
      followedPlan: true,
      mistake: 'None',
      notes: ''
    });
  };

  const exportToCSV = () => {
    const headers = ["Date,Pair,Direction,Entry Price,Exit Price,Size,PnL,Reason,Emotion,Result,Notes"];
    const rows = entries.map(e => 
      `${e.date},${e.pair},${e.direction},${e.entryPrice},${e.exitPrice},${e.positionSize},${e.calculatedPnL},"${e.entryReason}",${e.emotionPre},${e.result},"${e.notes}"`
    );
    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `trading_journal_cloud.csv`;
    link.click();
  };

  const totalPnL = entries.reduce((acc, curr) => acc + parseFloat(curr.calculatedPnL || 0), 0);
  const currentBalance = initialBalance + totalPnL;
  const growth = initialBalance > 0 ? ((currentBalance - initialBalance) / initialBalance) * 100 : 0;
  const winRate = entries.length > 0 ? ((entries.filter(e => e.result === 'Win').length / entries.length) * 100).toFixed(0) : 0;

  const emotions = [
    { value: 'Calm', label: '😌 สงบนิ่ง (Calm)', color: 'bg-blue-100 text-blue-800' },
    { value: 'Excited', label: '🤩 ตื่นเต้น (Excited)', color: 'bg-green-100 text-green-800' },
    { value: 'Anxious', label: '😰 กังวล (Anxious)', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'FOMO', label: '🏃‍♂️ FOMO', color: 'bg-orange-100 text-orange-800' },
    { value: 'Revenge', label: '😡 หัวร้อน (Revenge)', color: 'bg-red-100 text-red-800' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-20">
      <header className="bg-slate-800 p-4 sticky top-0 z-10 shadow-lg border-b border-slate-700 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <Brain className="text-cyan-400" />
            <div className="flex flex-col">
              <h1 className="font-bold text-lg bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent leading-none">Journal</h1>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                {isCloudEnabled ? <><Cloud size={10} className="text-green-500"/> Cloud Sync</> : <><CloudOff size={10} className="text-orange-500"/> Local Storage</>}
              </span>
            </div>
        </div>
        <div className="flex gap-2">
            {/* MM Calculator Button */}
            <button onClick={openMMCalculator} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600 text-yellow-400 border border-slate-600" title="MM Calculator">
                <Calculator size={18}/>
            </button>
            <button onClick={() => setShowStats(true)} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600 text-cyan-400 border border-slate-600" title="History">
                <Calendar size={18}/>
            </button>
            <button onClick={exportToCSV} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600" title="Export"><FileSpreadsheet size={18}/></button>
            <button onClick={() => {setShowForm(true); resetForm();}} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-full font-bold flex gap-2 text-sm items-center shadow-lg shadow-cyan-500/20"><Plus size={18}/> จดบันทึก</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-4">
             <Loader2 className="animate-spin text-cyan-500" size={40}/>
             <p>กำลังเชื่อมต่อกับ Firebase...</p>
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <DollarSign size={100} />
                </div>
                
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-slate-400 text-sm uppercase tracking-wider font-semibold">Total Portfolio Value</span>
                        <div className={`text-sm font-bold px-2 py-1 rounded-lg ${growth >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {growth >= 0 ? '▲' : '▼'} {Math.abs(growth).toFixed(2)}%
                        </div>
                    </div>
                    
                    <div className="text-4xl font-bold text-white mb-4 tracking-tight">
                        ${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-950/30 p-2 rounded-lg inline-block">
                        <span>Starting Balance:</span>
                        {isEditingBalance ? (
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    value={tempBalance} 
                                    onChange={(e) => setTempBalance(e.target.value)}
                                    className="bg-slate-700 text-white w-24 px-2 py-0.5 rounded border border-slate-600 outline-none focus:border-cyan-500"
                                />
                                <button onClick={saveBalance} className="text-green-400 hover:text-green-300"><Check size={16}/></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-slate-300">${initialBalance.toLocaleString()}</span>
                                <button onClick={() => {setIsEditingBalance(true); setTempBalance(initialBalance)}} className="text-slate-500 hover:text-cyan-400 transition-colors"><Edit2 size={12}/></button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                    <span className="text-xs text-slate-400 uppercase">Net PnL</span>
                    <div className={`text-xl sm:text-2xl font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalPnL > 0 ? '+' : ''}{totalPnL.toFixed(2)}
                    </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                    <span className="text-xs text-slate-400 uppercase">Win Rate</span>
                    <div className="text-xl sm:text-2xl font-bold text-cyan-400">{winRate}%</div>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                    <span className="text-xs text-slate-400 uppercase">Trades</span>
                    <div className="text-xl sm:text-2xl font-bold text-slate-200">{entries.length}</div>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-slate-400 text-sm font-bold uppercase mt-4">Recent Trades</h3>
                {entries.length === 0 && (
                  <div className="text-center py-10 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                    <p>ยังไม่มีรายการเทรด</p>
                    <p className="text-xs mt-2">กดปุ่ม + เพื่อเริ่มจดบันทึก</p>
                  </div>
                )}
                {entries.slice(0, 5).map(entry => (
                    <div key={entry.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-slate-500 transition-colors flex justify-between items-center group relative">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-bold px-1.5 rounded ${entry.direction === 'Long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{entry.direction}</span>
                                <span className="font-bold text-lg">{entry.pair}</span>
                                <span className="text-xs text-slate-500">{entry.date}</span>
                            </div>
                            <div className="text-sm text-slate-400 font-mono">
                                {entry.entryPrice} → {entry.exitPrice || '?'} ({entry.positionSize})
                            </div>
                        </div>
                        <div className="text-right">
                            <div className={`text-xl font-bold font-mono ${parseFloat(entry.calculatedPnL) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {parseFloat(entry.calculatedPnL) > 0 ? '+' : ''}{entry.calculatedPnL}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">{entry.result}</div>
                        </div>
                        <button onClick={() => deleteEntry(entry.id)} className="absolute top-4 right-4 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                    </div>
                ))}
                {entries.length > 5 && <p className="text-center text-xs text-slate-500 cursor-pointer hover:text-cyan-400" onClick={() => setShowStats(true)}>ดูทั้งหมดใน History</p>}
            </div>
          </>
        )}

        {/* --- MM Calculator Modal (UPDATED: Points & Real-time) --- */}
        {showMM && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-slate-800 w-full max-w-md rounded-2xl border border-slate-600 shadow-2xl overflow-hidden">
                <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="font-bold flex items-center gap-2 text-lg text-yellow-400"><Calculator size={24}/> MM Calculator</h2>
                    <button onClick={() => setShowMM(false)} className="bg-slate-700 p-1 rounded-full text-slate-400 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="p-5 space-y-4">
                   {/* Inputs */}
                   <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-xs text-slate-400 block mb-1">Account Balance ($)</label>
                        <input type="number" value={mmData.balance} onChange={e => setMmData({...mmData, balance: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Risk (%)</label>
                        <input type="number" value={mmData.riskPercent} onChange={e => setMmData({...mmData, riskPercent: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono" />
                      </div>
                      <div>
                         <label className="text-xs text-slate-400 block mb-1">Risk Amount ($)</label>
                         <div className="w-full bg-slate-700/50 border border-slate-600 rounded p-2 text-red-400 font-mono font-bold">
                            -${mmResults.riskAmount.toFixed(2)}
                         </div>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-700/50">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">SL Distance (Points)</label>
                        <input 
                            type="number" 
                            value={mmData.slPoints} 
                            onChange={e => setMmData({...mmData, slPoints: e.target.value})} 
                            className="w-full bg-slate-900 border border-red-900/50 rounded p-2 text-white font-mono text-lg focus:border-red-500" 
                            placeholder="e.g. 500" 
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">TP Distance (Points)</label>
                        <input 
                            type="number" 
                            value={mmData.tpPoints} 
                            onChange={e => setMmData({...mmData, tpPoints: e.target.value})} 
                            className="w-full bg-slate-900 border border-green-900/50 rounded p-2 text-white font-mono text-lg focus:border-green-500" 
                            placeholder="Optional" 
                        />
                      </div>
                   </div>

                   {/* Results Box */}
                   <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700 mt-4 space-y-3">
                      <div className="flex justify-between items-center">
                         <span className="text-sm text-slate-400">Position Size (Lot):</span>
                         <span className="text-3xl font-bold text-yellow-400 font-mono">{mmResults.positionSize > 0 ? mmResults.positionSize.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00'}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500">
                         <span>Risk: {mmData.slPoints} pts</span>
                         {mmResults.rr > 0 && <span className="text-green-400 font-bold">RR Ratio: 1 : {mmResults.rr.toFixed(2)}</span>}
                      </div>
                      {mmResults.profitAmount > 0 && (
                        <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                            <span className="text-xs text-slate-400">Potential Profit:</span>
                            <span className="text-lg font-bold text-green-400 font-mono">+${mmResults.profitAmount.toFixed(2)}</span>
                        </div>
                      )}
                   </div>

                   <button onClick={applySizeToForm} className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 text-black font-bold rounded-lg shadow-lg flex items-center justify-center gap-2">
                      <Target size={18}/> ใช้ค่านี้เปิดออเดอร์
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* History / Stats Modal */}
        {showStats && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 w-full max-w-lg rounded-2xl border border-slate-600 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col h-[80vh]">
                
                {/* Modal Header */}
                <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center shrink-0">
                    <h2 className="font-bold flex items-center gap-2 text-lg"><Calendar className="text-cyan-400"/> History</h2>
                    <button onClick={() => setShowStats(false)} className="bg-slate-700 p-1 rounded-full text-slate-400 hover:text-white"><X size={20}/></button>
                </div>
                
                {/* Filter Tabs */}
                <div className="p-3 bg-slate-800 border-b border-slate-700 shrink-0">
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {['today', 'week', 'month', 'year', 'all', 'custom'].map((ft) => (
                            <button 
                                key={ft}
                                onClick={() => setFilterType(ft)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterType === ft ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                            >
                                {ft === 'today' ? 'วันนี้' : ft === 'week' ? 'สัปดาห์นี้' : ft === 'month' ? 'เดือนนี้' : ft === 'year' ? 'ปีนี้' : ft === 'custom' ? 'เลือกวัน' : 'ทั้งหมด'}
                            </button>
                        ))}
                    </div>

                    {/* Custom Date Inputs */}
                    {filterType === 'custom' && (
                        <div className="flex items-center gap-2 mt-3 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                            <input 
                                type="date" 
                                value={customStartDate} 
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="bg-slate-800 text-white text-sm px-2 py-1 rounded border border-slate-600 outline-none w-full"
                            />
                            <span className="text-slate-500">-</span>
                            <input 
                                type="date" 
                                value={customEndDate} 
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="bg-slate-800 text-white text-sm px-2 py-1 rounded border border-slate-600 outline-none w-full"
                            />
                        </div>
                    )}
                </div>

                {/* Summary Bar for Selected Period */}
                <div className="bg-slate-700/30 p-4 shrink-0 flex justify-between items-center border-b border-slate-700">
                    <div>
                        <p className="text-xs text-slate-400 uppercase">Profit</p>
                        <p className={`text-xl font-bold ${filteredPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {filteredPnL > 0 ? '+' : ''}{filteredPnL.toFixed(2)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-400 uppercase">Trades / Win Rate</p>
                        <p className="text-sm font-bold text-slate-200">
                            {filteredTotal} Orders <span className="text-slate-500">|</span> <span className="text-cyan-400">{filteredWinRate}%</span>
                        </p>
                    </div>
                </div>

                {/* Scrollable Order List */}
                <div className="overflow-y-auto flex-1 p-0 bg-slate-900/50">
                    {filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <Filter size={40} className="mb-2 opacity-20"/>
                            <p>ไม่มีรายการในช่วงเวลานี้</p>
                        </div>
                    ) : (
                        filteredEntries.map((entry) => (
                            <div key={entry.id} className="p-4 border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors flex justify-between items-center">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-1.5 rounded ${entry.direction === 'Long' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                                            {entry.direction.toUpperCase()}
                                        </span>
                                        <span className="font-bold text-slate-200">{entry.pair}</span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {entry.date} <span className="mx-1">•</span> {entry.positionSize} Lot
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                        {entry.entryPrice} → {entry.exitPrice || '...'}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-bold font-mono ${parseFloat(entry.calculatedPnL) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {parseFloat(entry.calculatedPnL) > 0 ? '+' : ''}{entry.calculatedPnL}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1 bg-slate-800 px-2 py-0.5 rounded-full inline-block border border-slate-700">
                                        {entry.emotionPre}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
        )}

        {/* Input Form Modal */}
        {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 w-full max-w-lg rounded-2xl border border-slate-600 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="p-4 bg-slate-800 border-b border-slate-700 sticky top-0 flex justify-between items-center z-10">
                    <h2 className="font-bold flex items-center gap-2"><Crosshair className="text-cyan-400"/> คำนวณและบันทึก</h2>
                    <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-5 space-y-5">
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Asset (Pair)</label>
                            <input name="pair" value={formData.pair} onChange={handleInputChange} placeholder="BTC/USD" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white uppercase font-bold outline-none focus:border-cyan-500" required />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Position</label>
                            <div className="flex bg-slate-900 rounded p-1 border border-slate-700">
                                <button type="button" onClick={() => setFormData({...formData, direction: 'Long'})} className={`flex-1 rounded py-1 text-sm font-bold ${formData.direction === 'Long' ? 'bg-green-600 text-white' : 'text-slate-400'}`}>Long</button>
                                <button type="button" onClick={() => setFormData({...formData, direction: 'Short'})} className={`flex-1 rounded py-1 text-sm font-bold ${formData.direction === 'Short' ? 'bg-red-600 text-white' : 'text-slate-400'}`}>Short</button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-cyan-300 uppercase flex items-center gap-1"><DollarSign size={14}/> Trade Math</label>
                            <button type="button" onClick={openMMCalculator} className="text-[10px] text-yellow-400 hover:text-yellow-300 flex items-center gap-1"><Calculator size={10}/> คำนวณ MM</button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-[10px] text-slate-400 block">Entry Price</label>
                                <input type="number" name="entryPrice" value={formData.entryPrice} onChange={handleInputChange} placeholder="0.00" className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-sm text-white focus:border-cyan-500 outline-none" step="any" required />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 block">Exit Price</label>
                                <input type="number" name="exitPrice" value={formData.exitPrice} onChange={handleInputChange} placeholder="0.00" className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-sm text-white focus:border-cyan-500 outline-none" step="any" />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 block">Lot/Size</label>
                                <input type="number" name="positionSize" value={formData.positionSize} onChange={handleInputChange} placeholder="1" className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-sm text-white focus:border-cyan-500 outline-none" step="any" required />
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                            <span className="text-sm text-slate-400">Estimated PnL:</span>
                            <span className={`text-xl font-mono font-bold ${formData.calculatedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formData.calculatedPnL > 0 ? '+' : ''}{formData.calculatedPnL}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Date</label>
                            <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white outline-none" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Emotion (Pre-trade)</label>
                            <select name="emotionPre" value={formData.emotionPre} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white outline-none">
                                {emotions.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Note / Mistake</label>
                            <textarea name="notes" value={formData.notes} onChange={handleInputChange} placeholder="เข้าเพราะอะไร? ผิดพลาดตรงไหน?" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm h-20 outline-none focus:border-cyan-500" />
                        </div>
                    </div>

                    <button type="submit" className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white font-bold shadow-lg shadow-cyan-500/20 active:scale-95 transition-transform">Save Trade</button>
                </form>
            </div>
        </div>
        )}

      </main>
    </div>
  );
};

export default TradingJournal;