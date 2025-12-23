import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, TrendingUp, TrendingDown, Activity, Brain, AlertCircle, CheckCircle, FileSpreadsheet, Calculator, DollarSign, Edit2, Check } from 'lucide-react';

const TradingJournal = () => {
  const [entries, setEntries] = useState(() => {
    const saved = localStorage.getItem('trading_mindfulness_journal');
    return saved ? JSON.parse(saved) : [];
  });

  // State สำหรับเงินทุนเริ่มต้น
  const [initialBalance, setInitialBalance] = useState(() => {
    const saved = localStorage.getItem('trading_journal_balance');
    return saved ? parseFloat(saved) : 1000; // ค่าเริ่มต้น $1000 ถ้าไม่มีข้อมูล
  });
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [tempBalance, setTempBalance] = useState(initialBalance);

  const [showForm, setShowForm] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    id: '',
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

  // Save data & balance to LocalStorage
  useEffect(() => {
    localStorage.setItem('trading_mindfulness_journal', JSON.stringify(entries));
    localStorage.setItem('trading_journal_balance', initialBalance.toString());
  }, [entries, initialBalance]);

  // ระบบคำนวณกำไรอัตโนมัติ
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

  const emotions = [
    { value: 'Calm', label: '😌 สงบนิ่ง (Calm)', color: 'bg-blue-100 text-blue-800' },
    { value: 'Excited', label: '🤩 ตื่นเต้น (Excited)', color: 'bg-green-100 text-green-800' },
    { value: 'Anxious', label: '😰 กังวล (Anxious)', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'FOMO', label: '🏃‍♂️ FOMO', color: 'bg-orange-100 text-orange-800' },
    { value: 'Revenge', label: '😡 หัวร้อน (Revenge)', color: 'bg-red-100 text-red-800' },
  ];

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
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
      id: Date.now().toString(),
    };
    setEntries([newEntry, ...entries]);
    setShowForm(false);
    resetForm();
  };

  const deleteEntry = (id) => {
    if(confirm('ลบรายการนี้?')) setEntries(entries.filter(e => e.id !== id));
  };

  const resetForm = () => {
    setFormData({
      id: '',
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

  const saveBalance = () => {
      setInitialBalance(parseFloat(tempBalance));
      setIsEditingBalance(false);
  }

  const exportToCSV = () => {
    const headers = ["Date,Pair,Direction,Entry Price,Exit Price,Size,PnL,Reason,Emotion,Result,Notes"];
    const rows = entries.map(e => 
      `${e.date},${e.pair},${e.direction},${e.entryPrice},${e.exitPrice},${e.positionSize},${e.calculatedPnL},"${e.entryReason}",${e.emotionPre},${e.result},"${e.notes}"`
    );
    const csvContent = "\uFEFF" + [headers, ...rows].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `trading_journal_pro.csv`;
    link.click();
  };

  // Stats Calculations
  const totalPnL = entries.reduce((acc, curr) => acc + parseFloat(curr.calculatedPnL || 0), 0);
  const currentBalance = initialBalance + totalPnL;
  const winRate = entries.length > 0 ? ((entries.filter(e => e.result === 'Win').length / entries.length) * 100).toFixed(0) : 0;
  const growth = ((currentBalance - initialBalance) / initialBalance) * 100;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-20">
      {/* Header */}
      <header className="bg-slate-800 p-4 sticky top-0 z-10 shadow-lg border-b border-slate-700 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <Brain className="text-cyan-400" />
            <h1 className="font-bold text-lg bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Pro Trader Journal</h1>
        </div>
        <div className="flex gap-2">
            <button onClick={exportToCSV} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600"><FileSpreadsheet size={18}/></button>
            <button onClick={() => {setShowForm(true); resetForm();}} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-full font-bold flex gap-2 text-sm items-center shadow-lg shadow-cyan-500/20"><Plus size={18}/> จดบันทึก</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        
        {/* Main Balance Card */}
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

        {/* Dashboard Stats */}
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

        {/* Modal Form */}
        {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 w-full max-w-lg rounded-2xl border border-slate-600 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="p-4 bg-slate-800 border-b border-slate-700 sticky top-0 flex justify-between items-center z-10">
                    <h2 className="font-bold flex items-center gap-2"><Calculator className="text-cyan-400"/> คำนวณและบันทึก</h2>
                    <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-5 space-y-5">
                    
                    {/* 1. Setup & Direction */}
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

                    {/* 2. Calculator Zone */}
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-3">
                        <label className="text-xs font-bold text-cyan-300 uppercase flex items-center gap-1"><DollarSign size={14}/> Trade Math</label>
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
                        
                        {/* Auto PnL Display */}
                        <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                            <span className="text-sm text-slate-400">Estimated PnL:</span>
                            <span className={`text-xl font-mono font-bold ${formData.calculatedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formData.calculatedPnL > 0 ? '+' : ''}{formData.calculatedPnL}
                            </span>
                        </div>
                    </div>

                    {/* 3. Mindfulness & Notes */}
                    <div className="space-y-3">
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

        {/* Trade List */}
        <div className="space-y-3">
            {entries.map(entry => (
                <div key={entry.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-slate-500 transition-colors flex justify-between items-center group relative">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${entry.direction === 'Long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{entry.direction}</span>
                            <span className="font-bold text-lg">{entry.pair}</span>
                            <span className="text-xs text-slate-500">{entry.date}</span>
                        </div>
                        <div className="text-sm text-slate-400 font-mono">
                            <span className="text-slate-500">In:</span> {entry.entryPrice} <span className="text-slate-500">→ Out:</span> {entry.exitPrice || '-'} <span className="text-slate-500">({entry.positionSize} Lot)</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={`text-xl font-bold font-mono ${parseFloat(entry.calculatedPnL) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {parseFloat(entry.calculatedPnL) > 0 ? '+' : ''}{entry.calculatedPnL}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{entry.emotionPre}</div>
                    </div>
                    <button onClick={() => deleteEntry(entry.id)} className="absolute top-4 right-4 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                </div>
            ))}
        </div>

      </main>
    </div>
  );
};

export default TradingJournal;