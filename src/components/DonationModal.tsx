'use client';

import React, { useState } from 'react';
import { ThemedCard, ThemedText } from '@/components/ui/ThemeProvider';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DonationModal({ isOpen, onClose }: DonationModalProps) {
  const [activeTab, setActiveTab] = useState<'bitcoin' | 'github' | 'coffee'>('bitcoin');
  const [showLightning, setShowLightning] = useState(false);

  if (!isOpen) return null;

  const bitcoinAddress = "bc1qfr4ault2fk85g573d643wumv2pqupu7aa7jrmw";
  const lightningAddress = "wilqqthe@strike.me";
  const githubUrl = "https://github.com/wilqq-the/BTC-Tracker";
  const coffeeUrl = "https://buymeacoffee.com/wilqqthe";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Support Development
            </h2>
            <ThemedText variant="muted" size="sm" className="mt-1">
              Help keep this project free and open-source
            </ThemedText>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('bitcoin')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === 'bitcoin'
                ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50 dark:bg-orange-900/20'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            ₿ Bitcoin
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === 'github'
                ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50 dark:bg-orange-900/20'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            GitHub
          </button>
          <button
            onClick={() => setActiveTab('coffee')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === 'coffee'
                ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50 dark:bg-orange-900/20'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            ☕ Coffee
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'bitcoin' && (
            <div className="space-y-4">
              {/* Toggle between Bitcoin and Lightning */}
              <div className="flex justify-center">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex">
                  <button
                    onClick={() => setShowLightning(false)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      !showLightning 
                        ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400' 
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    ₿ Bitcoin
                  </button>
                  <button
                    onClick={() => setShowLightning(true)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      showLightning 
                        ? 'bg-white dark:bg-gray-700 text-yellow-600 dark:text-yellow-400' 
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    ⚡ Lightning
                  </button>
                </div>
              </div>

              {!showLightning ? (
                /* Bitcoin On-chain */
                <div className="text-center">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                    <div className="w-40 h-40 mx-auto bg-white rounded-lg p-2">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=bitcoin:${bitcoinAddress}`}
                        alt="Bitcoin QR Code"
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <div className="font-mono text-xs break-all text-gray-900 dark:text-gray-100">
                      {bitcoinAddress}
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(bitcoinAddress)}
                      className="mt-2 text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-medium"
                    >
                      Copy Address
                    </button>
                  </div>
                </div>
              ) : (
                /* Lightning Network */
                <div className="text-center">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <div className="w-40 h-40 mx-auto bg-white rounded-lg p-2">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent('lightning:' + lightningAddress)}`}
                        alt="Lightning QR Code"
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                      {lightningAddress}
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(lightningAddress)}
                      className="mt-2 text-sm text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 font-medium"
                    >
                      Copy Lightning Address
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'github' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="mb-6">
                  <svg className="w-16 h-16 mx-auto text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </div>
                
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                  </svg>
                  View on GitHub
                </a>
                
                <div className="mt-4">
                  <a
                    href={`${githubUrl}/issues`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Report an issue →
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'coffee' && (
            <div className="space-y-6">
              <div className="text-center">
                {/* Coffee QR Code */}
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-6">
                  <div className="w-32 h-32 mx-auto bg-white rounded-lg p-2">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(coffeeUrl)}`}
                      alt="Coffee Page QR Code"
                      className="w-full h-full"
                    />
                  </div>
                </div>
                
                <a
                  href={coffeeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium text-sm"
                >
                  <span className="mr-2 text-sm">☕</span>
                  Buy Me a Coffee
                </a>
                
                <div className="mt-4 px-4">
                  <ThemedText variant="muted" size="sm" className="block">
                    Support the project with a small donation
                  </ThemedText>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 rounded-b-xl">
          <div className="flex items-center justify-between">
            <ThemedText variant="muted" size="xs">
              Bitcoin Tracker v{process.env.npm_package_version || '0.6.0'} • Open Source
            </ThemedText>
            <ThemedText variant="muted" size="xs">
              Made with ❤️ for the Bitcoin community
            </ThemedText>
          </div>
        </div>
      </div>
    </div>
  );
} 