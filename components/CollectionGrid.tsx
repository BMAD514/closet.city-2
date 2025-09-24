/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { WardrobeItem } from '../types';
import { motion } from 'framer-motion';
import CollectionTile from './CollectionTile';

interface CollectionGridProps {
  wardrobe: WardrobeItem[];
  onItemSelect: (item: WardrobeItem, generatedTryOnUrl?: string) => void;
  modelImageUrl: string | null;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const CollectionGrid: React.FC<CollectionGridProps> = ({ wardrobe, onItemSelect, modelImageUrl }) => {
  return (
    <div className="w-full h-full max-w-6xl mx-auto flex flex-col items-center">
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-neutral-900 leading-tight tracking-tighter">
          The Archive
        </h1>
        <p className="mt-2 text-md text-neutral-600 max-w-2xl">
          {modelImageUrl 
            ? "A personalized lookbook generated for you. Select any piece to see more details."
            : "A curated collection of pieces. Select any item to see more details."
          }
        </p>
      </div>
      <motion.div
        className="w-full grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12 p-4 overflow-y-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {wardrobe.map((item) => (
          <CollectionTile 
            key={item.id}
            item={item}
            modelImageUrl={modelImageUrl}
            onSelect={onItemSelect}
          />
        ))}
      </motion.div>
    </div>
  );
};

export default CollectionGrid;