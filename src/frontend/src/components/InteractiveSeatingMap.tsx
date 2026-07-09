import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/getErrorMessage';

interface TicketCell {
  id: string;
  seat_label: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'CHECKED_IN' | 'HOLDING';
}

interface Props {
  concertId: string;
  ticketTypeId: string;
  mapConfig: {
    rows: number;
    cols: number;
    disabledSeats: string[];
  };
  selectedTicketIds: string[];
  onToggleSeat: (ticketId: string, seatLabel: string) => void | Promise<void>;
  maxPerUser: number;
}

export default function InteractiveSeatingMap({
  concertId,
  ticketTypeId,
  mapConfig,
  selectedTicketIds,
  onToggleSeat,
  maxPerUser
}: Props) {
  const [tickets, setTickets] = useState<TicketCell[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper to map tickets to grid
  const ticketMap = new Map<string, TicketCell>();
  tickets.forEach(t => ticketMap.set(t.seat_label, t));

  useEffect(() => {
    let active = true;
    let eventSource: EventSource | null = null;

    const fetchTickets = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/concerts/${concertId}/zones/${ticketTypeId}/tickets`);
        if (active) {
          setTickets(res.data);
          setLoading(false);
        }
      } catch (err) {
        toast.error(getErrorMessage(err, 'Lỗi tải trạng thái ghế'));
        if (active) setLoading(false);
      }
    };

    fetchTickets().then(() => {
      if (!active) return;
      
      // Setup SSE for real-time updates after initial fetch
      eventSource = new EventSource(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/concerts/${concertId}/zones/${ticketTypeId}/stream-tickets`);
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.ticketTypeId === ticketTypeId && Array.isArray(data.ticketIds)) {
            setTickets(prev => prev.map(t => 
              data.ticketIds.includes(t.id) ? { ...t, status: data.status } : t
            ));
          }
        } catch (error) {
          return; // Silent error for SSE parsing
        }
      };
    });

    return () => {
      active = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [concertId, ticketTypeId]);

  const disabledSet = new Set(mapConfig?.disabledSeats || []);
  const rows = mapConfig?.rows || 0;
  const cols = mapConfig?.cols || 0;

  const getRowLabel = (index: number) => {
    let label = '';
    let temp = index;
    while (temp >= 0) {
        label = String.fromCharCode((temp % 26) + 65) + label;
        temp = Math.floor(temp / 26) - 1;
    }
    return label;
  };

  if (loading && tickets.length === 0) {
    return <div className="p-12 text-center text-slate-400 animate-pulse">Đang tải sơ đồ ghế...</div>;
  }

  if (rows === 0 || cols === 0) {
    return <div className="p-12 text-center text-slate-400">Khu vực này chưa thiết lập sơ đồ ghế.</div>;
  }

  return (
    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
      <div className="text-xs text-slate-400 mb-6 flex flex-wrap gap-4 justify-center">
        <span className="flex items-center gap-2"><div className="w-5 h-5 bg-emerald-500 rounded"></div> Trống</span>
        <span className="flex items-center gap-2"><div className="w-5 h-5 bg-rose-500 rounded"></div> Đang chọn</span>
        <span className="flex items-center gap-2"><div className="w-5 h-5 bg-amber-500 rounded"></div> Đang giữ</span>
        <span className="flex items-center gap-2"><div className="w-5 h-5 bg-slate-600 rounded"></div> Đã bán</span>
      </div>

      <div className="overflow-x-auto bg-slate-900 p-8 rounded-xl min-h-[300px] flex justify-center">
        <div 
          className="grid gap-2" 
          style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(30px, 40px))` }}
        >
          <div className="col-span-full mb-8 h-12 bg-slate-800 rounded-t-3xl border-t-4 border-primary flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest">
            STAGE
          </div>

          {Array.from({ length: rows }).map((_, r) => {
            const rowLabel = getRowLabel(r);
            return (
              <React.Fragment key={`row-${r}`}>
                <div className="flex items-center justify-center font-bold text-slate-500 pr-4">
                  {rowLabel}
                </div>
                
                {Array.from({ length: cols }).map((_, c) => {
                  const key = `${r}-${c}`;
                  if (disabledSet.has(key)) {
                    return <div key={`empty-${c}`} className="w-full h-8" />;
                  }

                  const seatLabel = `${rowLabel}${c + 1}`;
                  const ticket = ticketMap.get(seatLabel);
                  
                  if (!ticket) {
                    return <div key={`empty-ticket-${c}`} className="w-full h-8 bg-slate-800/30 rounded" />;
                  }

                  const isAvailable = ticket.status === 'AVAILABLE';
                  const isSelected = selectedTicketIds.includes(ticket.id);

                  let bgClass = "bg-slate-600 text-slate-400 cursor-not-allowed"; // SOLD
                  if (isSelected) {
                    bgClass = "bg-rose-500 text-white shadow-lg shadow-rose-500/50 scale-110 z-10 cursor-pointer";
                  } else if (ticket.status === 'HOLDING') {
                    bgClass = "bg-amber-500 text-amber-900 cursor-not-allowed"; // HOLDING
                  } else if (isAvailable) {
                    bgClass = "bg-emerald-500 text-white hover:bg-emerald-400 cursor-pointer";
                  }

                  return (
                    <div
                      key={`seat-${c}`}
                      onClick={() => {
                        if (isAvailable || isSelected) {
                          if (!isSelected && selectedTicketIds.length >= maxPerUser) {
                            toast.error(`Bạn chỉ được chọn tối đa ${maxPerUser} ghế cho loại vé này!`);
                            return;
                          }
                          onToggleSeat(ticket.id, seatLabel);
                        }
                      }}
                      className={`h-8 rounded flex items-center justify-center text-[10px] font-bold transition-all ${bgClass}`}
                      title={`${seatLabel} - ${isAvailable ? 'Trống' : 'Đã bán'}`}
                    >
                      {c + 1}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
