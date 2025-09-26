/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface DtpJobSubmissionResponse {
  jobId: string;
  status: string;
  createdAt?: string;
}

export interface DtpJobStatus {
  jobId: string;
  status: string;
  resultUrl?: string | null;
  updatedAt?: string;
}

interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = 'http://localhost:4000';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/?$/, '') ?? DEFAULT_BASE_URL;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
};

const requestHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

const parseJson = async (response: Response) => {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
};

export const submitDtpRequest = async (file: File, token: string): Promise<DtpJobSubmissionResponse> => {
  if (!token) {
    throw new Error('Authentication is required to submit a DTP job.');
  }

  const photoBase64 = await fileToBase64(file);
  const response = await fetch(`${API_BASE_URL}/api/dtp/process`, {
    method: 'POST',
    headers: requestHeaders(token),
    body: JSON.stringify({
      photoBase64,
      metadata: {
        jobType: 'BASE_AVATAR',
      },
    }),
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : 'Failed to queue DTP job.';
    throw new Error(message);
  }

  return payload as DtpJobSubmissionResponse;
};

const imageUrlToBase64 = async (imageUrl: string): Promise<string> => {
  if (!imageUrl) {
    throw new Error('Garment image URL is required for overlay generation.');
  }

  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error('Failed to fetch garment reference image.');
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

interface GarmentOverlayRequest {
  baseAvatarDataUrl: string;
  garmentImageUrl: string;
  token: string;
  garmentId?: string;
  garmentName?: string;
}

export const submitGarmentOverlayRequest = async ({
  baseAvatarDataUrl,
  garmentImageUrl,
  token,
  garmentId,
  garmentName,
}: GarmentOverlayRequest): Promise<DtpJobSubmissionResponse> => {
  if (!token) {
    throw new Error('Authentication is required to submit a garment overlay job.');
  }

  if (!baseAvatarDataUrl) {
    throw new Error('Base avatar image is required before fitting garments.');
  }

  const garmentImageBase64 = await imageUrlToBase64(garmentImageUrl);

  const response = await fetch(`${API_BASE_URL}/api/dtp/process`, {
    method: 'POST',
    headers: requestHeaders(token),
    body: JSON.stringify({
      photoBase64: baseAvatarDataUrl,
      garmentImageBase64,
      metadata: {
        jobType: 'GARMENT_OVERLAY',
        garmentId,
        garmentName,
        garmentImageUrl,
      },
    }),
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : 'Failed to queue garment overlay job.';
    throw new Error(message);
  }

  return payload as DtpJobSubmissionResponse;
};

export const fetchDtpStatus = async (jobId: string, token: string): Promise<DtpJobStatus> => {
  if (!token) {
    throw new Error('Authentication is required to check job status.');
  }

  const response = await fetch(`${API_BASE_URL}/api/dtp/status/${jobId}`, {
    method: 'GET',
    headers: requestHeaders(token),
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : 'Failed to fetch DTP status.';
    throw new Error(message);
  }

  return payload as DtpJobStatus;
};

export const pollDtpStatus = async (
  jobId: string,
  token: string,
  options: PollOptions = {}
): Promise<DtpJobStatus> => {
  const intervalMs = options.intervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 60000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const status = await fetchDtpStatus(jobId, token);
    if (status.status === 'READY' || status.status === 'FAILED') {
      return status;
    }
    await delay(intervalMs);
  }

  throw new Error('Timed out waiting for the DTP job to complete.');
};

