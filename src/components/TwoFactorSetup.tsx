'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ShieldCheckIcon,
  ShieldOffIcon,
  CopyIcon,
  CheckIcon,
  AlertTriangleIcon,
  QrCodeIcon,
} from 'lucide-react';

interface TwoFactorSetupProps {
  isEnabled: boolean;
  onStatusChange?: () => void;
}

export default function TwoFactorSetup({ isEnabled, onStatusChange }: TwoFactorSetupProps) {
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [step, setStep] = useState<'qr' | 'verify' | 'backup'>('qr');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Setup state
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);
  
  // Disable state
  const [disableCode, setDisableCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');

  const startSetup = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (!result.success) {
        setError(result.error || 'Failed to start setup');
        return;
      }
      
      setQrCode(result.data.qrCode);
      setSecret(result.data.secret);
      setStep('qr');
      setShowSetupModal(true);
    } catch (err) {
      setError('Failed to start 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        setError(result.error || 'Invalid code');
        return;
      }
      
      setBackupCodes(result.data.backupCodes);
      setStep('backup');
    } catch (err) {
      setError('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const finishSetup = () => {
    setShowSetupModal(false);
    resetState();
    onStatusChange?.();
  };

  const disable2FA = async () => {
    if (!disableCode || !disablePassword) {
      setError('Please enter both your verification code and password');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: disableCode,
          password: disablePassword 
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        setError(result.error || 'Failed to disable 2FA');
        return;
      }
      
      setShowDisableModal(false);
      resetState();
      onStatusChange?.();
    } catch (err) {
      setError('Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setStep('qr');
    setQrCode('');
    setSecret('');
    setVerificationCode('');
    setBackupCodes([]);
    setDisableCode('');
    setDisablePassword('');
    setError('');
    setCopiedSecret(false);
    setCopiedBackupCodes(false);
  };

  const copyToClipboard = async (text: string, type: 'secret' | 'backup') => {
    await navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedBackupCodes(true);
      setTimeout(() => setCopiedBackupCodes(false), 2000);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-[17px] font-bold tracking-tight">Two-factor authentication</CardTitle>
          <CardDescription className="text-[13px]">
            Ask for a code from an authenticator app (Google Authenticator, Authy and similar) when you sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary p-4">
            <div className="flex items-center gap-3">
              {isEnabled ? (
                <ShieldCheckIcon className="size-5 shrink-0 text-tint-green-fg" />
              ) : (
                <ShieldOffIcon className="size-5 shrink-0 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {isEnabled ? 'Two-factor sign-in is on' : 'Two-factor sign-in is off'}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {isEnabled 
                    ? 'Signing in needs your password and a code from your app.' 
                    : 'Only your password protects this account.'}
                </p>
              </div>
            </div>
            <Button
              variant={isEnabled ? 'outline' : 'default'}
              size="sm"
              className="rounded-full font-semibold"
              onClick={isEnabled ? () => setShowDisableModal(true) : startSetup}
              disabled={loading}
            >
              {loading ? (
                <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-label="Loading" />
              ) : isEnabled ? (
                'Turn off'
              ) : (
                'Turn on'
              )}
            </Button>
          </div>
          {error && !showSetupModal && !showDisableModal && (
            <p className="text-[13px] text-tint-red-fg">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Setup Modal */}
      <Dialog open={showSetupModal} onOpenChange={(open) => {
        if (!open) resetState();
        setShowSetupModal(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="size-5 text-primary-strong" />
              {step === 'qr' && 'Set up two-factor sign-in'}
              {step === 'verify' && 'Enter the code'}
              {step === 'backup' && 'Save your backup codes'}
            </DialogTitle>
            <DialogDescription>
              {step === 'qr' && 'Scan the QR code with your authenticator app.'}
              {step === 'verify' && 'Type the 6-digit code your app shows now.'}
              {step === 'backup' && 'Each code signs you in once if you lose your phone. Keep them somewhere safe.'}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex items-center gap-2 rounded-2xl bg-tint-red p-3 text-sm text-tint-red-fg">
              <AlertTriangleIcon className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {step === 'qr' && (
            <div className="space-y-4">
              <div className="flex justify-center rounded-2xl bg-white p-4">
                {qrCode && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrCode} alt="QR code for your authenticator app" className="w-48 h-48" />
                )}
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Can&apos;t scan it? Enter this key in the app instead
                </Label>
                <div className="flex gap-2">
                  <code className="flex-1 rounded-xl bg-secondary p-2.5 text-xs font-mono break-all">
                    {secret}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    aria-label="Copy key"
                    onClick={() => copyToClipboard(secret, 'secret')}
                  >
                    {copiedSecret ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verificationCode">Code from your app</Label>
                <Input
                  id="verificationCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  maxLength={6}
                  autoFocus
                />
              </div>
            </div>
          )}

          {step === 'backup' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-2xl bg-tint-orange p-3 text-sm text-primary-strong">
                <AlertTriangleIcon className="size-4 shrink-0 mt-0.5" />
                <p>Save these codes now. They won&apos;t be shown again.</p>
              </div>
              
              <div className="card-solid grid grid-cols-2 gap-2 rounded-2xl p-4">
                {backupCodes.map((code, i) => (
                  <code key={i} className="text-sm font-mono text-center py-1">
                    {code}
                  </code>
                ))}
              </div>
              
              <Button
                variant="outline"
                className="w-full rounded-full font-semibold"
                onClick={() => copyToClipboard(backupCodes.join('\n'), 'backup')}
              >
                {copiedBackupCodes ? (
                  <>
                    <CheckIcon className="size-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <CopyIcon className="size-4" />
                    Copy all codes
                  </>
                )}
              </Button>
            </div>
          )}

          <DialogFooter>
            {step === 'qr' && (
              <Button onClick={() => setStep('verify')} className="w-full rounded-full font-semibold">
                Continue
              </Button>
            )}
            {step === 'verify' && (
              <div className="flex gap-2 w-full">
                <Button variant="outline" onClick={() => setStep('qr')} className="flex-1 rounded-full font-semibold">
                  Back
                </Button>
                <Button 
                  onClick={verifyAndEnable} 
                  disabled={loading || verificationCode.length !== 6}
                  className="flex-1 rounded-full font-semibold"
                >
                  {loading ? 'Checking...' : 'Turn on'}
                </Button>
              </div>
            )}
            {step === 'backup' && (
              <Button onClick={finishSetup} className="w-full rounded-full font-semibold">
                I&apos;ve saved my backup codes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Modal */}
      <Dialog open={showDisableModal} onOpenChange={(open) => {
        if (!open) resetState();
        setShowDisableModal(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldOffIcon className="size-5" />
              Turn off two-factor sign-in
            </DialogTitle>
            <DialogDescription>
              Confirm with a code from your app (or a backup code) and your password.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex items-center gap-2 rounded-2xl bg-tint-red p-3 text-sm text-tint-red-fg">
              <AlertTriangleIcon className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disableCode">Code or backup code</Label>
              <Input
                id="disableCode"
                type="text"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                placeholder="Enter code"
                className="font-mono"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="disablePassword">Password</Label>
              <Input
                id="disablePassword"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-full font-semibold" onClick={() => setShowDisableModal(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              className="rounded-full font-semibold"
              onClick={disable2FA}
              disabled={loading || !disableCode || !disablePassword}
            >
              {loading ? 'Turning off...' : 'Turn off'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

