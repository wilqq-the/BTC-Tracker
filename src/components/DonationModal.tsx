'use client';

import React, { useState } from 'react';
import { ThemedCard, ThemedText } from '@/components/ui/ThemeProvider';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DonationModal({ isOpen, onClose }: DonationModalProps) {
  const [activeTab, setActiveTab] = useState<'bitcoin' | 'github' | 'coffee'>('bitcoin');

  if (!isOpen) return null;

  const bitcoinAddress = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
  const lightningAddress = "donate@bitcointracker.dev";
  const githubUrl = "https://github.com/your-username/bitcoin-tracker";
  const coffeeUrl = "https://buymeacoffee.com/bitcointracker";

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
            <div className="space-y-6">
              <div className="text-center">
                <ThemedText variant="secondary" className="mb-4">
                  Send Bitcoin directly to support development
                </ThemedText>
                
                {/* Bitcoin QR Code Placeholder */}
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-4">
                  <div className="w-48 h-48 mx-auto bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📱</div>
                      <ThemedText variant="muted" size="sm">
                        QR Code
                      </ThemedText>
                      <ThemedText variant="muted" size="xs">
                        Scan with wallet
                      </ThemedText>
                    </div>
                  </div>
                </div>

                {/* Bitcoin Address */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <ThemedText variant="muted" size="xs" className="mb-1">
                    Bitcoin Address
                  </ThemedText>
                  <div className="font-mono text-sm break-all text-gray-900 dark:text-gray-100">
                    {bitcoinAddress}
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(bitcoinAddress)}
                    className="mt-2 text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                  >
                    Copy Address
                  </button>
                </div>

                {/* Lightning */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 mt-4">
                  <div className="flex items-center justify-center mb-2">
                    <span className="text-yellow-600 dark:text-yellow-400 mr-2">⚡</span>
                    <ThemedText size="sm" className="font-medium">
                      Lightning Network
                    </ThemedText>
                  </div>
                  <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                    {lightningAddress}
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(lightningAddress)}
                    className="mt-1 text-xs text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300"
                  >
                    Copy Lightning Address
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'github' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-4">🌟</div>
                <ThemedText className="text-lg font-medium mb-2">
                  Star the Repository
                </ThemedText>
                <ThemedText variant="secondary" className="mb-6">
                  Show your support by starring the project on GitHub
                </ThemedText>
                
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                  </svg>
                  View on GitHub
                </a>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <ThemedText size="sm" className="font-medium mb-2">
                  🐛 Found a bug?
                </ThemedText>
                <ThemedText variant="secondary" size="sm" className="mb-3">
                  Report issues or suggest features on GitHub
                </ThemedText>
                <a
                  href={`${githubUrl}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
                >
                  Report Issue →
                </a>
              </div>
            </div>
          )}

          {activeTab === 'coffee' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-4">☕</div>
                <ThemedText className="text-lg font-medium mb-2">
                  Buy Me a Coffee
                </ThemedText>
                <ThemedText variant="secondary" className="mb-6">
                  Support development with a small donation
                </ThemedText>
                
                <a
                  href={coffeeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  <span className="mr-2">☕</span>
                  Buy Me a Coffee
                </a>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <ThemedText size="sm" className="font-medium mb-2">
                  💚 Why donate?
                </ThemedText>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Keep the project free and open-source</li>
                  <li>• Fund new features and improvements</li>
                  <li>• Support ongoing maintenance</li>
                  <li>• Help with server costs</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 rounded-b-xl">
          <div className="flex items-center justify-between">
            <ThemedText variant="muted" size="xs">
              Bitcoin Tracker • Open Source
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