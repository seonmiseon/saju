import React from 'react';
import { Pillar } from '../types';

interface PillarCardProps {
  title: string;
  pillar: Pillar;
}

const elementColors: Record<string, string> = {
  'Wood': 'text-green-800 border-green-200 bg-green-50',
  'Fire': 'text-red-800 border-red-200 bg-red-50',
  'Earth': 'text-yellow-800 border-yellow-200 bg-[#F5DEB3]',
  'Metal': 'text-gray-700 border-gray-300 bg-gray-100',
  'Water': 'text-blue-900 border-blue-200 bg-blue-50',
};

const PillarCard: React.FC<PillarCardProps> = ({ title, pillar }) => {
  const colorClass = elementColors[pillar.element] || 'text-gray-800 border-gray-200 bg-gray-50';

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs font-serif text-gray-500 mb-1">{title}</span>
      <div className={`flex flex-col items-center border border-gray-300 shadow-sm w-full rounded-md overflow-hidden bg-white`}>
        
        {/* Stem (Heavenly Stem) */}
        <div className="w-full flex flex-col items-center py-2 border-b border-gray-100 relative">
           {/* Ten God Top Label */}
          <span className="text-[11px] font-bold text-gray-600 mb-1">{pillar.stemTenGod}</span>
          {/* Hanja + Korean */}
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-serif font-bold text-black leading-tight">{pillar.stem}</span>
            <span className="text-sm text-gray-500 font-medium">({pillar.stemKorean})</span>
          </div>
        </div>

        {/* Branch (Earthly Branch) */}
        <div className={`w-full flex flex-col items-center py-2 ${colorClass.replace('text-', 'bg-opacity-20 ')}`}>
           {/* Hanja + Korean */}
           <div className="flex items-baseline space-x-1">
             <span className="text-3xl font-serif font-bold text-black leading-tight">{pillar.branch}</span>
             <span className="text-sm text-gray-500 font-medium">({pillar.branchKorean})</span>
           </div>
          {/* Ten God Bottom Label */}
          <span className="text-[11px] font-bold text-gray-600 mt-1">{pillar.branchTenGod}</span>
        </div>
        
      </div>
      {/* Element Badge */}
      <span className={`mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorClass} bg-white`}>
        {pillar.element}
      </span>
    </div>
  );
};

export default PillarCard;