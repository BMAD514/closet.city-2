/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import type { WardrobeItem } from '../types';
import { CheckCircleIcon, ShirtIcon } from './icons';

interface WardrobePanelProps {
  wardrobe: WardrobeItem[];
  onItemSelect: (item: WardrobeItem) => void;
  activeGarmentIds: string[];
  isLoading: boolean;
}

const WardrobePanel: React.FC<WardrobePanelProps> = ({ wardrobe, onItemSelect, activeGarmentIds, isLoading }) => {
  return (
    <div className="pt-6 border-t border-neutral-300">
        <h2 className="text-lg font-serif tracking-wider text-neutral-900 mb-3">The Archive</h2>
        {wardrobe.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
              {wardrobe.map((item) => {
              const isActive = activeGarmentIds.includes(item.id);
              return (
                  <button
                  key={item.id}
                  onClick={() => onItemSelect(item)}
                  disabled={isLoading}
                  className="relative aspect-square border border-neutral-200 rounded-lg overflow-hidden transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black group disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-label={`Select ${item.name}`}
                  >
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-xs font-bold text-center p-1">{item.name}</p>
                  </div>
                  {isActive && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                          <CheckCircleIcon className="w-8 h-8 text-white" />
                      </div>
                  )}
                  </button>
              );
              })}
          </div>
        ) : (
          <div className="text-center text-sm text-neutral-500 py-8 flex flex-col items-center gap-3">
            <ShirtIcon className="w-8 h-8 text-neutral-400" />
            <p>No items in The Archive.</p>
          </div>
        )}
    </div>
  );
};

export default WardrobePanel;
