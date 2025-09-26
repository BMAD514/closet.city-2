/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloudIcon } from './icons';
import { Compare } from './ui/compare';
import Spinner from './Spinner';
import { getFriendlyErrorMessage } from '../lib/utils';
import { submitDtpRequest, pollDtpStatus, DtpJobStatus } from '../services/dtpService';
import {
  AuthSession,
  getAuthErrorMessage,
  loginUser,
  registerUser,
} from '../services/authService';

interface StartScreenProps {
  onModelFinalized: (modelUrl: string) => void;
  onBrowseAsGuest: () => void;
  onAuthSuccess: (session: AuthSession) => void;
  onLogout: () => void;
  authToken: string | null;
  userEmail: string | null;
}

type AuthMode = 'login' | 'register';

type JobState = 'IDLE' | 'QUEUED' | 'READY' | 'FAILED';

const StartScreen: React.FC<StartScreenProps> = ({
  onModelFinalized,
  onBrowseAsGuest,
  onAuthSuccess,
  onLogout,
  authToken,
  userEmail,
}) => {
  const [userImageUrl, setUserImageUrl] = useState<string | null>(null);
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobState, setJobState] = useState<JobState>('IDLE');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const isAuthenticated = Boolean(authToken);

  const resetGeneration = useCallback(() => {
    setUserImageUrl(null);
    setGeneratedModelUrl(null);
    setIsGenerating(false);
    setJobState('IDLE');
    setStatusMessage('');
    setError(null);
  }, []);

  useEffect(() => {
    if (!authToken) {
      resetGeneration();
    }
  }, [authToken, resetGeneration]);

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (!email || !password) {
      setAuthError('Please provide both email and password.');
      return;
    }

    setIsAuthenticating(true);

    try {
      if (authMode === 'register') {
        await registerUser(email, password);
        setAuthSuccess('Account created. Welcome to closet.city.');
      }

      const session = await loginUser(email, password);
      onAuthSuccess(session);
      setAuthSuccess(prev => prev ?? 'Signed in successfully.');
      setEmail('');
      setPassword('');
    } catch (err) {
      setAuthError(getAuthErrorMessage(err, authMode === 'register' ? 'Failed to create account.' : 'Failed to sign in.'));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogoutClick = () => {
    onLogout();
    resetGeneration();
  };

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!isAuthenticated || !authToken) {
        setError('Please sign in before uploading a photo.');
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError('Please select an image file.');
        return;
      }

      const reader = new FileReader();
      reader.onload = async e => {
        const dataUrl = e.target?.result as string;
        setUserImageUrl(dataUrl);
        setGeneratedModelUrl(null);
        setError(null);
        setJobState('QUEUED');
        setStatusMessage('Queued. Generating your personal model...');
        setIsGenerating(true);

        try {
          const submission = await submitDtpRequest(file, authToken);
          setStatusMessage('Processing...');

          const finalStatus: DtpJobStatus = await pollDtpStatus(submission.jobId, authToken, {
            intervalMs: 2000,
            timeoutMs: 60000,
          });

          if (finalStatus.status === 'READY' && finalStatus.resultUrl) {
            setGeneratedModelUrl(finalStatus.resultUrl);
            setJobState('READY');
            setStatusMessage('Model ready. Step into the fitting room.');
          } else {
            setJobState('FAILED');
            setStatusMessage('Generation failed.');
            throw new Error(finalStatus.status === 'FAILED' ? 'The job failed to complete.' : 'Model URL missing from response.');
          }
        } catch (err) {
          setError(getFriendlyErrorMessage(err, 'Failed to process your look.'));
          setJobState('FAILED');
          setGeneratedModelUrl(null);
          setStatusMessage('');
        } finally {
          setIsGenerating(false);
        }
      };
      reader.readAsDataURL(file);
    },
    [authToken, isAuthenticated]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const screenVariants = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  };

  return (
    <AnimatePresence mode="wait">
      {!userImageUrl ? (
        <motion.div
          key="uploader"
          className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12"
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        >
          <div className="lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">
            <div className="max-w-lg space-y-6">
              <div>
                <h1 className="text-5xl md:text-6xl font-serif font-bold text-neutral-900 leading-tight tracking-tighter">
                  closet.city
                </h1>
                <p className="mt-4 text-lg text-neutral-600">
                  Resale, reimagined. Upload a photo to create your virtual model and try on our curated archive. Define your own look.
                </p>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white/70 backdrop-blur-sm p-6 w-full">
                {!isAuthenticated ? (
                  <form className="space-y-4" onSubmit={handleAuthSubmit}>
                    <div className="flex justify-between items-center">
                      <h2 className="text-lg font-semibold text-neutral-900">{authMode === 'login' ? 'Sign in' : 'Create account'}</h2>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode(prev => (prev === 'login' ? 'register' : 'login'));
                          setAuthError(null);
                          setAuthSuccess(null);
                        }}
                        className="text-sm font-medium text-neutral-600 hover:text-black"
                      >
                        {authMode === 'login' ? 'Need an account?' : 'Have an account?'}
                      </button>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="email"
                        value={email}
                        onChange={event => setEmail(event.target.value)}
                        placeholder="Email"
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
                        autoComplete="email"
                        required
                      />
                      <input
                        type="password"
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        placeholder="Password"
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
                        autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                        minLength={8}
                        required
                      />
                    </div>

                    {authError && <p className="text-sm text-red-500">{authError}</p>}
                    {authSuccess && <p className="text-sm text-emerald-600">{authSuccess}</p>}

                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
                      disabled={isAuthenticating}
                    >
                      {isAuthenticating ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-3 text-left">
                    <p className="text-sm text-neutral-600">
                      Signed in as <span className="font-medium text-neutral-900">{userEmail}</span>.
                    </p>
                    <button
                      onClick={handleLogoutClick}
                      className="text-sm font-semibold text-neutral-700 hover:text-black"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center lg:items-start w-full gap-3">
                <label
                  htmlFor="image-upload-start"
                  className={`w-full relative flex items-center justify-center px-8 py-3 text-base font-semibold text-white rounded-md cursor-pointer transition-colors ${
                    isAuthenticated ? 'bg-black hover:bg-neutral-800' : 'bg-neutral-400 cursor-not-allowed'
                  } ${isGenerating ? 'opacity-70' : ''}`}
                >
                  <UploadCloudIcon className="w-5 h-5 mr-3" />
                  Upload Photo
                </label>
                <input
                  id="image-upload-start"
                  type="file"
                  className="hidden"
                  accept="image/png, image/jpeg, image/webp, image/avif, image/heic, image/heif"
                  onChange={handleFileChange}
                  disabled={!isAuthenticated || isGenerating}
                />

                <button
                  onClick={onBrowseAsGuest}
                  className={`w-full relative flex items-center justify-center px-8 py-3 text-base font-semibold rounded-md transition-colors ${
                    isAuthenticated ? 'text-neutral-700 bg-neutral-200 hover:bg-neutral-300' : 'text-neutral-400 bg-neutral-100 cursor-not-allowed'
                  }`}
                  disabled={!isAuthenticated}
                >
                  Browse the Collection
                </button>

                <p className="text-neutral-500 text-xs mt-1">
                  By uploading, you agree not to create harmful, explicit, or unlawful content. This service is for creative and responsible use only.
                </p>
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                {jobState === 'QUEUED' && statusMessage && !error && (
                  <p className="text-sm text-neutral-600">{statusMessage}</p>
                )}
              </div>
            </div>
          </div>
          <div className="w-full lg:w-1/2 flex flex-col items-center justify-center">
            <Compare
              firstImage="https://storage.googleapis.com/gemini-95-icons/asr-tryon.jpg"
              secondImage="https://storage.googleapis.com/gemini-95-icons/asr-tryon-model.png"
              slideMode="drag"
              className="w-full max-w-sm aspect-[2/3] rounded-2xl bg-neutral-200"
            />
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="compare"
          className="w-full max-w-6xl mx-auto h-full flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12"
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        >
          <div className="md:w-1/2 flex-shrink-0 flex flex-col items-center md:items-start">
            <div className="text-center md:text-left">
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-neutral-900 leading-tight tracking-tighter">
                Your Model
              </h1>
              <p className="mt-2 text-md text-neutral-600">
                This is your personal model for trying on clothes. Drag the slider to compare.
              </p>
            </div>

            {(isGenerating || jobState === 'QUEUED') && (
              <div className="flex items-center gap-3 text-lg text-neutral-700 font-serif mt-6">
                <Spinner />
                <span>{statusMessage || 'Generating your model...'}</span>
              </div>
            )}

            {error && (
              <div className="text-center md:text-left text-red-600 max-w-md mt-6">
                <p className="font-semibold">Generation Failed</p>
                <p className="text-sm mb-4">{error}</p>
                <button onClick={resetGeneration} className="text-sm font-semibold text-neutral-700 hover:underline">Try Again</button>
              </div>
            )}

            {jobState === 'READY' && !error && statusMessage && (
              <p className="mt-6 text-sm text-emerald-600 font-medium">{statusMessage}</p>
            )}

            <AnimatePresence>
              {generatedModelUrl && !isGenerating && !error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col sm:flex-row items-center gap-4 mt-8"
                >
                  <button
                    onClick={resetGeneration}
                    className="w-full sm:w-auto px-6 py-3 text-base font-semibold text-neutral-700 bg-neutral-200 rounded-md cursor-pointer hover:bg-neutral-300 transition-colors"
                  >
                    Upload New Photo
                  </button>
                  <button
                    onClick={() => onModelFinalized(generatedModelUrl)}
                    className="w-full sm:w-auto relative inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-black rounded-md cursor-pointer group hover:bg-neutral-800 transition-colors"
                  >
                    Enter Fitting Room
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="md:w-1/2 w-full flex items-center justify-center">
            <div
              className={`relative rounded-[1.25rem] transition-all duration-700 ease-in-out ${
                isGenerating ? 'border border-neutral-300 animate-pulse' : 'border border-transparent'
              }`}
            >
              <Compare
                firstImage={userImageUrl}
                secondImage={generatedModelUrl ?? userImageUrl}
                slideMode="drag"
                className="w-[280px] h-[420px] sm:w-[320px] sm:h-[480px] lg:w-[400px] lg:h-[600px] rounded-2xl bg-neutral-200"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StartScreen;
