'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** Style the confirm button as destructive (red) */
  destructive?: boolean;
}

type Resolver = (value: boolean) => void;

// Module-level bridge so confirm() can be called imperatively from anywhere
// (event handlers, async flows) without prop/hook plumbing.
let externalOpen: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

/**
 * Promise-based confirmation dialog — a styled drop-in for window.confirm().
 *
 * @example
 *   if (!(await confirm('Delete this goal?'))) return;
 *   const ok = await confirm({ title: 'Delete user', description: '...', destructive: true });
 */
export function confirm(options: ConfirmOptions | string = {}): Promise<boolean> {
  const opts = typeof options === 'string' ? { description: options } : options;
  if (externalOpen) return externalOpen(opts);
  // Fallback if the host isn't mounted (SSR / very early calls)
  if (typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(opts.description || opts.title || 'Are you sure?'));
  }
  return Promise.resolve(false);
}

/** Mounted once at the app root; renders the actual dialog. */
export function ConfirmDialogHost() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({});
  const [resolver, setResolver] = useState<{ fn: Resolver } | null>(null);

  useEffect(() => {
    externalOpen = (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setOpts(o);
        setResolver({ fn: resolve });
        setOpen(true);
      });
    return () => {
      externalOpen = null;
    };
  }, []);

  const finish = useCallback(
    (result: boolean) => {
      setOpen(false);
      resolver?.fn(result);
      setResolver(null);
    },
    [resolver]
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{opts.title || 'Are you sure?'}</DialogTitle>
          {opts.description && (
            <DialogDescription>{opts.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => finish(false)}>
            {opts.cancelText || 'Cancel'}
          </Button>
          <Button
            variant={opts.destructive ? 'destructive' : 'default'}
            onClick={() => finish(true)}
          >
            {opts.confirmText || 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
