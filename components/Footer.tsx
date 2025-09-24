/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className={`fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-neutral-200 p-3 z-40`}>
      <div className="mx-auto flex items-center justify-between text-xs text-neutral-800 font-semibold tracking-widest uppercase max-w-7xl px-4">
        <p>closet.city</p>
        <p className="hidden sm:block">Resale, Reimagined.</p>
      </div>
    </footer>
  );
};

export default Footer;
