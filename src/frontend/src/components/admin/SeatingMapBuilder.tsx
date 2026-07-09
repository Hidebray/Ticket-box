import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Save, Plus, Minus } from 'lucide-react';

interface Props {
  concertId: string;
  ticketTypeId: string;
  initialRows?: number;
  initialCols?: number;
  initialDisabled?: string[];
  onSave?: () => void;
}

export default function SeatingMapBuilder({ 
  concertId, 
  ticketTypeId, 
  initialRows = 10, 
  initialCols = 20, 
  initialDisabled = [],
  onSave 
}: Props) {
  const { token } = useAuth();
  const [rows, setRows] = useState(initialRows);
  const [cols, setCols] = useState(initialCols);
  const [disabledSeats, setDisabledSeats] = useState<Set<string>>(new Set(initialDisabled));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setRows(initialRows);
    setCols(initialCols);
    setDisabledSeats(new Set(initialDisabled));
  }, [initialRows, initialCols, initialDisabled]);

  const toggleSeat = (r: number, c: number, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent context menu if right clicked
    const key = `${r}-${c}`;
    const newSet = new Set(disabledSeats);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setDisabledSeats(newSet);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/concerts/${concertId}/zones/${ticketTypeId}/seating`, {
        rows,
        cols,
        disabledSeats: Array.from(disabledSeats)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Đã lưu sơ đồ ghế thành công!');
      if (onSave) onSave();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Có lỗi xảy ra khi lưu sơ đồ.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRowLabel = (index: number) => {
    let label = '';
    let temp = index;
    while (temp >= 0) {
        label = String.fromCharCode((temp % 26) + 65) + label;
        temp = Math.floor(temp / 26) - 1;
    }
    return label;
  };

  return (
    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold">Xây dựng sơ đồ (Dynamic Grid)</h3>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isLoading ? 'Đang lưu...' : 'Lưu sơ đồ'}
        </button>
      </div>

      <div className="flex gap-6 mb-6 p-4 bg-slate-900 rounded-xl">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Số Hàng (Rows)</label>
          <div className="flex items-center gap-2">
            <button onClick={() => setRows(r => Math.max(1, r - 1))} className="p-1 bg-slate-700 rounded"><Minus className="w-4 h-4"/></button>
            <input type="number" value={rows} onChange={e => setRows(Number(e.target.value) || 1)} className="w-16 text-center bg-slate-800 rounded border border-slate-700" />
            <button onClick={() => setRows(r => r + 1)} className="p-1 bg-slate-700 rounded"><Plus className="w-4 h-4"/></button>
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Số Ghế/Hàng (Cols)</label>
          <div className="flex items-center gap-2">
            <button onClick={() => setCols(c => Math.max(1, c - 1))} className="p-1 bg-slate-700 rounded"><Minus className="w-4 h-4"/></button>
            <input type="number" value={cols} onChange={e => setCols(Number(e.target.value) || 1)} className="w-16 text-center bg-slate-800 rounded border border-slate-700" />
            <button onClick={() => setCols(c => c + 1)} className="p-1 bg-slate-700 rounded"><Plus className="w-4 h-4"/></button>
          </div>
        </div>
        <div className="ml-auto flex items-end">
           <p className="text-sm text-slate-400">Tổng: {rows * cols - disabledSeats.size} ghế hoạt động</p>
        </div>
      </div>

      <div className="text-xs text-slate-400 mb-4 flex gap-4">
        <span className="flex items-center gap-2"><div className="w-4 h-4 bg-emerald-500 rounded"></div> Ghế đang mở</span>
        <span className="flex items-center gap-2"><div className="w-4 h-4 bg-slate-700 rounded"></div> Khoảng trống (Disabled) - Click để đổi</span>
      </div>

      {/* Grid Container */}
      <div className="overflow-x-auto bg-slate-900 p-8 rounded-xl min-h-[400px] flex justify-center">
        <div 
          className="grid gap-2" 
          style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(30px, 40px))` }}
        >
          {/* Sân khấu */}
          <div className="col-span-full mb-8 h-12 bg-slate-800 rounded-t-3xl border-t-4 border-emerald-500 flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest shadow-[0_-10px_20px_rgba(16,185,129,0.1)]">
            STAGE
          </div>

          {Array.from({ length: rows }).map((_, r) => (
            <React.Fragment key={`row-${r}`}>
              {/* Tên hàng */}
              <div className="flex items-center justify-center font-bold text-slate-500 pr-4">
                {getRowLabel(r)}
              </div>
              
              {/* Các ghế trong hàng */}
              {Array.from({ length: cols }).map((_, c) => {
                const isDisabled = disabledSeats.has(`${r}-${c}`);
                return (
                  <div
                    key={`seat-${r}-${c}`}
                    onMouseDown={(e) => toggleSeat(r, c, e)}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`h-8 rounded flex items-center justify-center text-[10px] font-bold cursor-pointer select-none transition-all ${
                      isDisabled 
                        ? 'bg-slate-800 text-slate-700 border border-slate-800 hover:border-slate-600' 
                        : 'bg-emerald-500 text-white shadow hover:bg-emerald-400 hover:scale-110 hover:shadow-emerald-500/50'
                    }`}
                  >
                    {!isDisabled && c + 1}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
