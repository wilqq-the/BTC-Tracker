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
  KeyIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
          <CardTitle className="flex items-center gap-2">
            <ShieldCheckIcon className="size-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              {isEnabled ? (
                <div className="size-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <ShieldCheckIcon className="size-5 text-green-500" />
                </div>
              ) : (
                <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                  <ShieldOffIcon className="size-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-medium">
                  {isEnabled ? '2FA is enabled' : '2FA is not enabled'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isEnabled 
                    ? 'Your account is protected with an authenticator app' 
                    : 'Enable 2FA for enhanced security'}
                </p>
              </div>
            </div>
            <Button
              variant={isEnabled ? "outline" : "default"}
              onClick={isEnabled ? () => setShowDisableModal(true) : startSetup}
              disabled={loading}
            >
              {loading ? (
                <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isEnabled ? (
                'Disable'
              ) : (
                'Enable 2FA'
              )}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Two-factor authentication adds an additional layer of security by requiring a code from your 
            authenticator app (Google Authenticator, Authy, etc.) when signing in.
          </p>
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
              <ShieldCheckIcon className="size-5 text-primary" />
              {step === 'qr' && 'Set Up 2FA'}
              {step === 'verify' && 'Verify Code'}
              {step === 'backup' && 'Save Backup Codes'}
            </DialogTitle>
            <DialogDescription>
              {step === 'qr' && 'Scan the QR code with your authenticator app'}
              {step === 'verify' && 'Enter the 6-digit code from your app'}
              {step === 'backup' && 'Save these codes in a safe place'}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              <AlertTriangleIcon className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {step === 'qr' && (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg">
                {qrCode && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                )}
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Or enter this code manually:
                </Label>
                <div className="flex gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">
                    {secret}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
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
                <Label htmlFor="verificationCode">Verification Code</Label>
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
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-2 text-yellow-600 dark:text-yellow-500">
                  <AlertTriangleIcon className="size-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Important!</p>
                    <p>Save these codes now. You will not be able to see them again.</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg">
                {backupCodes.map((code, i) => (
                  <code key={i} className="text-sm font-mono text-center py-1">
                    {code}
                  </code>
                ))}
              </div>
              
              <Button
                variant="outline"
                className="w-full"
                onClick={() => copyToClipboard(backupCodes.join('\n'), 'backup')}
              >
                {copiedBackupCodes ? (
                  <>
                    <CheckIcon className="size-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <CopyIcon className="size-4 mr-2" />
                    Copy All Codes
                  </>
                )}
              </Button>
            </div>
          )}

          <DialogFooter>
            {step === 'qr' && (
              <Button onClick={() => setStep('verify')} className="w-full">
                Continue
              </Button>
            )}
            {step === 'verify' && (
              <div className="flex gap-2 w-full">
                <Button variant="outline" onClick={() => setStep('qr')} className="flex-1">
                  Back
                </Button>
                <Button 
                  onClick={verifyAndEnable} 
                  disabled={loading || verificationCode.length !== 6}
                  className="flex-1"
                >
                  {loading ? 'Verifying...' : 'Verify & Enable'}
                </Button>
              </div>
            )}
            {step === 'backup' && (
              <Button onClick={finishSetup} className="w-full">
                I have saved my backup codes
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
              Disable Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Enter your verification code and password to disable 2FA
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              <AlertTriangleIcon className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disableCode">Verification Code or Backup Code</Label>
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
            <Button variant="outline" onClick={() => setShowDisableModal(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={disable2FA}
              disabled={loading || !disableCode || !disablePassword}
            >
              {loading ? 'Disabling...' : 'Disable 2FA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

