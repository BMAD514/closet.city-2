/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Spinner from './Spinner';

interface ProductGalleryProps {
    poses: Record<string, string>;
    poseInstructions: string[];
    onGeneratePose: (poseInstruction: string) => void;
    isLoading: boolean;
    loadingMessage: string;
    isGuestMode: boolean;
    onStartOver: () => void;
}

const ProductGallery: React.FC<ProductGalleryProps> = ({ poses, poseInstructions, onGeneratePose, isLoading, loadingMessage, isGuestMode, onStartOver }) => {
    const mainTryOnImage = poses[poseInstructions[0]];

    return (
        <div className="w-full h-full overflow-y-auto p-4 space-y-4">
            <AnimatePresence>
                {isLoading && (
                    <motion.div
                        className="fixed inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <Spinner />
                        {loadingMessage && (
                            <p className="text-lg font-serif text-neutral-800 mt-4 text-center px-4">{loadingMessage}</p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            
            {mainTryOnImage ? (
                <div className="space-y-6">
                    <motion.img
                        key={mainTryOnImage}
                        src={mainTryOnImage}
                        alt="Main virtual try-on view"
                        className="w-full h-auto object-cover"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                    />

                    {isGuestMode && (
                        <div className="w-full border border-neutral-200 bg-neutral-100 p-4 text-center">
                            <h3 className="font-serif font-semibold text-neutral-800">Like what you see?</h3>
                            <p className="text-sm text-neutral-600 mt-1 mb-3">Upload your own photo to see how it looks on you.</p>
                            <button 
                                onClick={onStartOver}
                                className="text-sm font-semibold text-white bg-black px-4 py-2 rounded-md hover:bg-neutral-800 transition-colors"
                            >
                                Upload a Photo
                            </button>
                        </div>
                    )}

                    {poseInstructions.slice(1).map(instruction => (
                        <div key={instruction}>
                            {poses[instruction] ? (
                                <motion.img
                                    src={poses[instruction]}
                                    alt={`Detail view: ${instruction}`}
                                    className="w-full h-auto object-cover"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.5 }}
                                />
                            ) : (
                                <div className="w-full aspect-[3/4] border border-neutral-200 bg-neutral-100 flex items-center justify-center">
                                    <button 
                                        onClick={() => onGeneratePose(instruction)}
                                        disabled={isLoading}
                                        className="text-sm font-semibold text-neutral-700 bg-white border border-neutral-300 px-4 py-2 rounded-md hover:bg-neutral-50 disabled:opacity-50"
                                    >
                                        {isGuestMode ? `Show ${instruction}` : `Generate ${instruction}`}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                 <div className="w-full h-full flex items-center justify-center">
                    <div className="w-full aspect-[3/4] bg-neutral-100 border border-neutral-200 flex flex-col items-center justify-center">
                        <Spinner />
                        <p className="text-md font-serif text-neutral-600 mt-4">Generating Try-On...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductGallery;