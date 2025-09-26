/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type HFCViewerProps = {
  baseAvatarUrl: string | null;
  overlayImageUrl?: string | null;
  isProcessing?: boolean;
  statusMessage?: string;
  selectedGarmentName?: string | null;
  onStartOver?: () => void;
};

const HFCViewer: React.FC<HFCViewerProps> = ({
  baseAvatarUrl,
  overlayImageUrl,
  isProcessing = false,
  statusMessage,
  selectedGarmentName,
  onStartOver,
}) => {
  const hasBaseAvatar = Boolean(baseAvatarUrl);
  const displayImage = overlayImageUrl || baseAvatarUrl;
  const showOverlayBadge = Boolean(overlayImageUrl);

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Hyper-Fit Chamber</h2>
          <p className="text-sm text-neutral-600">
            {showOverlayBadge
              ? 'Final fitted render powered by closet.city.'
              : hasBaseAvatar
              ? 'Your base avatar is ready. Choose a garment to fit it.'
              : 'Upload a portrait to begin your digital fitting.'}
          </p>
        </div>
        {onStartOver && (
          <button
            type="button"
            onClick={onStartOver}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            Start over
          </button>
        )}
      </div>

      <div className="relative flex-1 min-h-[360px] rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        {displayImage ? (
          <img
            src={displayImage}
            alt={showOverlayBadge ? 'Fitted garment render' : 'Base avatar preview'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400 text-sm">
            Upload a base avatar to preview your look.
          </div>
        )}

        <AnimatePresence>
          {isProcessing && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-2"
            >
              <div className="animate-spin rounded-full border-4 border-white/30 border-t-white/80 h-10 w-10" />
              <p className="text-sm font-medium text-center px-4">
                {statusMessage ?? 'Fitting your garment...'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {showOverlayBadge && selectedGarmentName && (
          <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            {selectedGarmentName}
          </div>
        )}

        {showOverlayBadge && hasBaseAvatar && baseAvatarUrl && (
          <div className="absolute bottom-4 right-4 bg-white/90 rounded-lg shadow-sm overflow-hidden border border-neutral-200">
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-neutral-500 font-semibold">
              Base avatar
            </div>
            <img
              src={baseAvatarUrl}
              alt="Base avatar thumbnail"
              className="h-24 w-20 object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default HFCViewer;
