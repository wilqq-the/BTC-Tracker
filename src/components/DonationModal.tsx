'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  BitcoinIcon, 
  ZapIcon, 
  GithubIcon, 
  CoffeeIcon,
  CopyIcon,
  ExternalLinkIcon,
  HeartHandshakeIcon
} from 'lucide-react';
import packageJson from '../../package.json';
import Image from 'next/image';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DonationModal({ isOpen, onClose }: DonationModalProps) {
  const [showLightning, setShowLightning] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const bitcoinAddress = "bc1qfr4ault2fk85g573d643wumv2pqupu7aa7jrmw";
  const lightningAddress = "wilqqthe@strike.me";
  const githubUrl = "https://github.com/wilqq-the/BTC-Tracker";
  const coffeeUrl = "https://buymeacoffee.com/wilqqthe";

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <HeartHandshakeIcon className="size-6 text-btc-500" />
              Support Development
          </DialogTitle>
          <DialogDescription>
              Help keep this project free and open-source
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="bitcoin" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bitcoin" className="gap-1.5">
              <BitcoinIcon className="size-4" />
              <span>Bitcoin</span>
            </TabsTrigger>
            <TabsTrigger value="github" className="gap-1.5">
              <GithubIcon className="size-4" />
              <span>GitHub</span>
            </TabsTrigger>
            <TabsTrigger value="coffee" className="gap-1.5">
              <CoffeeIcon className="size-4" />
              <span>Coffee</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bitcoin" className="space-y-4 mt-4">
            {/* Bitcoin/Lightning Toggle */}
              <div className="flex justify-center">
              <div className="inline-flex rounded-lg border p-1 bg-muted">
                <Button
                  variant={!showLightning ? "default" : "ghost"}
                  size="sm"
                    onClick={() => setShowLightning(false)}
                  className={!showLightning ? "bg-btc-500 hover:bg-btc-600" : ""}
                >
                  <BitcoinIcon className="size-4 mr-1.5" />
                  Bitcoin
                </Button>
                <Button
                  variant={showLightning ? "default" : "ghost"}
                  size="sm"
                    onClick={() => setShowLightning(true)}
                  className={showLightning ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                  >
                  <ZapIcon className="size-4 mr-1.5" />
                  Lightning
                </Button>
                </div>
              </div>

              {!showLightning ? (
                /* Bitcoin On-chain */
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-center">
                    <div className="bg-white dark:bg-card p-4 rounded-lg border">
                      <Image
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=bitcoin:${bitcoinAddress}`}
                        alt="Bitcoin QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-center">Bitcoin Address</p>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="font-mono text-xs break-all text-center">
                      {bitcoinAddress}
                      </p>
                    </div>
                    <Button
                      onClick={() => copyToClipboard(bitcoinAddress, 'bitcoin')}
                      variant="outline"
                      className="w-full"
                      size="sm"
                    >
                      <CopyIcon className="size-4 mr-2" />
                      {copied === 'bitcoin' ? 'Copied!' : 'Copy Address'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              ) : (
                /* Lightning Network */
              <Card className="border-yellow-200 dark:border-yellow-800">
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-center">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <Image
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('lightning:' + lightningAddress)}`}
                        alt="Lightning QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-center flex items-center justify-center gap-1.5">
                      <ZapIcon className="size-4 text-yellow-500" />
                      Lightning Address
                    </p>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="font-mono text-sm text-center">
                      {lightningAddress}
                      </p>
                    </div>
                    <Button
                      onClick={() => copyToClipboard(lightningAddress, 'lightning')}
                      variant="outline"
                      className="w-full border-yellow-200 hover:bg-yellow-50 dark:border-yellow-800 dark:hover:bg-yellow-900/20"
                      size="sm"
                    >
                      <CopyIcon className="size-4 mr-2" />
                      {copied === 'lightning' ? 'Copied!' : 'Copy Lightning Address'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="github" className="space-y-4 mt-4">
            <Card>
              <CardContent className="p-6 space-y-6 text-center">
                <div className="flex justify-center">
                  <div className="p-4 rounded-full bg-muted">
                    <GithubIcon className="size-16" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Open Source Project</h3>
                  <p className="text-sm text-muted-foreground">
                    Star the repository, contribute code, or report issues
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Button
                    asChild
                    className="w-full"
                    size="lg"
                  >
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                      <GithubIcon className="size-4 mr-2" />
                  View on GitHub
                      <ExternalLinkIcon className="size-4 ml-2" />
                    </a>
                  </Button>
                  
                  <Button
                    asChild
                    variant="outline"
                    className="w-full"
                  >
                  <a
                    href={`${githubUrl}/issues`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                      Report an Issue
                      <ExternalLinkIcon className="size-4 ml-2" />
                  </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coffee" className="space-y-4 mt-4">
            <Card className="border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-6 space-y-6">
                <div className="flex justify-center">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <Image
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(coffeeUrl)}`}
                      alt="Coffee Page QR Code"
                      className="w-40 h-40"
                    />
                  </div>
                </div>
                
                <div className="space-y-2 text-center">
                  <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                    <CoffeeIcon className="size-5 text-yellow-600 dark:text-yellow-500" />
                    Buy Me a Coffee
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Support the project with a small donation
                  </p>
                </div>

                <Button
                  asChild
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                  size="lg"
                >
                <a
                  href={coffeeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                    <CoffeeIcon className="size-4 mr-2" />
                  Buy Me a Coffee
                    <ExternalLinkIcon className="size-4 ml-2" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <Separator className="my-4" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-medium">BTC Tracker</span>
            <Separator orientation="vertical" className="h-3" />
            <span>v{packageJson.version}</span>
            <Badge variant="outline" className="ml-2">Open Source</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <HeartHandshakeIcon className="size-3.5 text-btc-500" />
            <span>Made for the Bitcoin community</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 