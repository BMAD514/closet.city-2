/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CollectionGrid from '../../components/CollectionGrid';
import Spinner from '../../components/Spinner';
import { WardrobeItem } from '../../types';
import { getFriendlyErrorMessage } from '../../lib/utils';
import {
  pollDtpStatus,
  submitGarmentOverlayRequest,
  DtpJobStatus,
} from '../../services/dtpService';
import HFCViewer from '../components/HFCViewer';

type CollectionScreenProps = {
  wardrobe: WardrobeItem[];
  baseAvatarUrl: string | null;
  token: string | null;
  isCatalogLoading: boolean;
  catalogError: string | null;
  onOverlayReady: (item: WardrobeItem, overlayUrl: string) => void;
  onOverlayError: (message: string) => void;
};

const resolveGarmentImageUrl = (item: WardrobeItem): string => {
  return (
    item.pregeneratedTryOnUrl ||
    item.pregeneratedLookbookUrl ||
    item.url ||
    ''
  );
};

const CollectionScreen: React.FC<CollectionScreenProps> = ({
  wardrobe,
  baseAvatarUrl,
  token,
  isCatalogLoading,
  catalogError,
  onOverlayReady,
  onOverlayError,
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const selectedItem = useMemo(
    () => wardrobe.find(item => item.id === selectedItemId) ?? null,
    [selectedItemId, wardrobe],
  );

  const handleItemSelect = useCallback(
    async (item: WardrobeItem) => {
      if (!isMountedRef.current) {
        return;
      }

      setLocalError(null);

      if (!token) {
        const message = 'Please sign in to try on garments.';
        if (isMountedRef.current) {
          setLocalError(message);
        }
        onOverlayError(message);
        return;
      }

      if (!baseAvatarUrl) {
        const message = 'Generate your base avatar before selecting garments.';
        if (isMountedRef.current) {
          setLocalError(message);
        }
        onOverlayError(message);
        return;
      }

      const garmentImageUrl = resolveGarmentImageUrl(item);
      if (!garmentImageUrl) {
        const message = 'Selected garment is missing a reference image for fitting.';
        if (isMountedRef.current) {
          setLocalError(message);
        }
        onOverlayError(message);
        return;
      }

      if (!isMountedRef.current) {
        return;
      }

      setSelectedItemId(item.id);
      setIsSubmitting(true);
      setStatusMessage(`Fitting ${item.name}...`);

      try {
        const submission = await submitGarmentOverlayRequest({
          baseAvatarDataUrl: baseAvatarUrl,
          garmentImageUrl,
          token,
          garmentId: item.id,
          garmentName: item.name,
        });

        const finalStatus: DtpJobStatus = await pollDtpStatus(submission.jobId, token, {
          intervalMs: 2000,
          timeoutMs: 60000,
        });

        if (finalStatus.status === 'READY' && finalStatus.resultUrl) {
          onOverlayReady(item, finalStatus.resultUrl);
        } else {
          throw new Error(
            finalStatus.status === 'FAILED'
              ? 'The garment overlay job failed to complete.'
              : 'Garment overlay result is missing from the response.',
          );
        }
      } catch (error) {
        const message = getFriendlyErrorMessage(error, 'Failed to fit this garment. Try again.');
        if (isMountedRef.current) {
          setLocalError(message);
        }
        onOverlayError(message);
      } finally {
        if (isMountedRef.current) {
          setIsSubmitting(false);
          setStatusMessage('');
        }
      }
    },
    [baseAvatarUrl, onOverlayError, onOverlayReady, token],
  );

  return (
    <div className="w-full h-full flex flex-col lg:flex-row gap-8">
      <section className="w-full lg:w-[45%] xl:w-[40%] flex flex-col">
        <HFCViewer
          baseAvatarUrl={baseAvatarUrl}
          overlayImageUrl={null}
          isProcessing={isSubmitting}
          statusMessage={statusMessage}
          selectedGarmentName={selectedItem?.name ?? null}
        />
        {(localError || catalogError) && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {localError || catalogError}
          </div>
        )}
      </section>

      <section className="w-full lg:flex-1 min-h-0">
        {isCatalogLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-neutral-600">
            <Spinner />
            <p>Loading your archive...</p>
          </div>
        ) : (
          <CollectionGrid
            wardrobe={wardrobe}
            onItemSelect={handleItemSelect}
            modelImageUrl={baseAvatarUrl}
          />
        )}
      </section>
    </div>
  );
};

export default CollectionScreen;
