

interface SeatCell {
  status: number;
  type: string;
}

export interface SeatingMapData {
  rows: number;
  columns: number;
  layout: SeatCell[][];
}

interface SeatingMapProps {
  mapData: SeatingMapData;
  selectedType: string | null;
  onSelectType: (type: string) => void;
}

export default function SeatingMap({ mapData, selectedType, onSelectType }: SeatingMapProps) {
  // Mapping type to color class
  const getColor = (type: string) => {
    const baseColor = 
      type.includes('VVIP') ? 'bg-fuchsia-500 hover:bg-fuchsia-400' :
      type.includes('VIP') ? 'bg-amber-500 hover:bg-amber-400' :
      'bg-emerald-500 hover:bg-emerald-400';

    if (!selectedType) return baseColor;
    if (selectedType === type) return `${baseColor} scale-110 shadow-lg ring-2 ring-white z-10`;
    return `${baseColor} opacity-30`;
  };

  return (
    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
      <h3 className="text-xl font-bold mb-6 text-center text-slate-300">Sơ Đồ Sân Khấu</h3>
      
      {/* Stage */}
      <div className="w-2/3 h-12 bg-slate-700 mx-auto rounded-t-3xl mb-8 flex items-center justify-center border-b-4 border-primary shadow-[0_4px_20px_rgba(244,63,94,0.3)]">
        <span className="text-slate-400 font-bold uppercase tracking-widest text-sm">Sân Khấu</span>
      </div>

      {/* Grid */}
      <div className="flex flex-col gap-2 items-center">
        {mapData.layout.map((row, rIndex) => (
          <div key={rIndex} className="flex gap-2">
            {row.map((cell, cIndex) => {
              if (cell.status === 0 || !cell.type) {
                return <div key={cIndex} className="w-6 h-6 sm:w-8 sm:h-8" />;
              }
              return (
                <div 
                  key={cIndex}
                  onClick={() => onSelectType(cell.type)}
                  className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md cursor-pointer transition-all duration-200 ${getColor(cell.type)}`}
                  title={cell.type}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-fuchsia-500"></div>
          <span className="text-sm text-slate-300">VVIP</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-amber-500"></div>
          <span className="text-sm text-slate-300">VIP</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-500"></div>
          <span className="text-sm text-slate-300">GA</span>
        </div>
      </div>
    </div>
  );
}
