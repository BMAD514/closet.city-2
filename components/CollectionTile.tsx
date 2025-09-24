/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { WardrobeItem } from '../types';
import { generateVirtualTryOnImage } from '../services/geminiService';
import { motion } from 'framer-motion';
import Spinner from './Spinner';

interface CollectionTileProps {
  item: WardrobeItem;
  modelImageUrl: string | null;
  onSelect: (item: WardrobeItem, generatedTryOnUrl?: string) => void;
}

const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type });
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

const CollectionTile: React.FC<CollectionTileProps> = ({ item, modelImageUrl, onSelect }) => {
  const [liveShotUrl, setLiveShotUrl] = useState<string | null>(item.pregeneratedLookbookUrl || null);
  const [isLoading, setIsLoading] = useState(!item.pregeneratedLookbookUrl && !!modelImageUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateLiveShot = async () => {
      // Only generate if in personal mode (modelImageUrl exists)
      if (!modelImageUrl) {
        setIsLoading(false);
        if (!item.pregeneratedLookbookUrl) {
          setError("Preview not available");
        }
        return;
      }
      
      setIsLoading(true);
      setError(null);
      try {
        const garmentFile = await dataUrlToFile(item.url, item.name);
        const newImageUrl = await generateVirtualTryOnImage(modelImageUrl, garmentFile);
        setLiveShotUrl(newImageUrl);
      } catch (err) {
        setError('Failed to generate preview');
        console.error(`Failed to generate live shot for ${item.name}:`, err);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Trigger generation only if we are in personalized mode.
    if (modelImageUrl) {
      generateLiveShot();
    }
  }, [item, modelImageUrl]);

  const handleSelect = () => {
    if (!isLoading) {
      onSelect(item, liveShotUrl || undefined);
    }
  }

  return (
    <motion.div variants={itemVariants}>
      <button
        onClick={handleSelect}
        disabled={isLoading || (!liveShotUrl && !!modelImageUrl)}
        className="w-full text-left group focus:outline-none disabled:cursor-wait"
      >
        <div className="grid grid-cols-2 gap-2 w-full aspect-[2/1.3] mb-3">
          <div className="bg-neutral-100 rounded-sm overflow-hidden">
            <img src={item.url} alt={item.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          </div>
          <div className="bg-neutral-100 rounded-sm overflow-hidden flex items-center justify-center">
            {isLoading && <Spinner />}
            {error && <p className="text-xs text-red-500 text-center p-2">{error}</p>}
            {liveShotUrl && !error && (
              <img src={liveShotUrl} alt={`Model wearing ${item.name}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            )}
            {!isLoading && !liveShotUrl && !error && (
                <p className="text-xs text-neutral-500 text-center p-2">Preview not available</p>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center text-sm">
          <h3 className="font-semibold text-neutral-800 group-hover:underline">{item.name}</h3>
          {item.price && (
            <p className="text-neutral-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.price)}</p>
          )}
        </div>
      </button>
    </motion.div>
  );
};

export default CollectionTile;