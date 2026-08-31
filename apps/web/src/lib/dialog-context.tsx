'use client';

import { createContext, useCallback, useContext, useState } from 'react';

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Styles the confirm button as .btn-danger instead of .btn-primary — use
  // for anything destructive/irreversible (delete, withdraw, cancel).
  danger?: boolean;
}

interface AlertOptions {
  title?: string;
  okLabel?: string;
}

interface PromptOptions {
  title?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
}

type DialogState =
  | { type: 'confirm'; message: string; options?: ConfirmOptions; resolve: (v: boolean) => void }
  | { type: 'alert'; message: string; options?: AlertOptions; resolve: () => void }
  | { type: 'prompt'; message: string; options?: PromptOptions; resolve: (v: string | null) => void };

interface DialogContextValue {
  confirmDialog: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  alertDialog: (message: string, options?: AlertOptions) => Promise<void>;
  promptDialog: (message: string, defaultValue?: string, options?: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

// App-wide replacement for window.confirm/alert/prompt — those block the
// whole tab and look like the browser chrome, not this app. Named with a
// "Dialog" suffix throughout (confirmDialog, not confirm) so it never
// silently shadows a local variable/function called `confirm` — several
// call sites (e.g. dashboard/interviews/page.tsx's slot-confirmation
// handler) already have their own function named exactly that.
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [promptError, setPromptError] = useState<string | null>(null);

  const confirmDialog = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setDialog({ type: 'confirm', message, options, resolve }));
  }, []);

  const alertDialog = useCallback((message: string, options?: AlertOptions) => {
    return new Promise<void>((resolve) => setDialog({ type: 'alert', message, options, resolve }));
  }, []);

  const promptDialog = useCallback((message: string, defaultValue = '', options?: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(defaultValue);
      setPromptError(null);
      setDialog({ type: 'prompt', message, options, resolve });
    });
  }, []);

  function close() {
    setDialog(null);
    setPromptError(null);
  }

  function resolveConfirm(value: boolean) {
    if (dialog?.type === 'confirm') dialog.resolve(value);
    close();
  }

  function resolveAlert() {
    if (dialog?.type === 'alert') dialog.resolve();
    close();
  }

  function resolvePromptCancel() {
    if (dialog?.type === 'prompt') dialog.resolve(null);
    close();
  }

  function resolvePromptSubmit() {
    if (dialog?.type !== 'prompt') return;
    const trimmed = promptValue.trim();
    if (dialog.options?.required && !trimmed) {
      setPromptError('This field is required.');
      return;
    }
    dialog.resolve(trimmed || null);
    close();
  }

  return (
    <DialogContext.Provider value={{ confirmDialog, alertDialog, promptDialog }}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 bg-ink/40 z-[100] flex items-center justify-center p-4"
          onClick={dialog.type === 'alert' ? resolveAlert : dialog.type === 'confirm' ? () => resolveConfirm(false) : resolvePromptCancel}
        >
          <div className="bg-white rounded-card shadow-2 max-w-[420px] w-full" onClick={(e) => e.stopPropagation()}>
            {dialog.options?.title && (
              <div className="px-6 py-4 border-b border-border font-semibold">{dialog.options.title}</div>
            )}
            <div className="p-6 flex flex-col gap-4">
              <p className="text-sm leading-relaxed whitespace-pre-line">{dialog.message}</p>

              {dialog.type === 'prompt' && (
                <div>
                  <input
                    autoFocus
                    className="input"
                    value={promptValue}
                    placeholder={dialog.options?.placeholder}
                    onChange={(e) => { setPromptValue(e.target.value); setPromptError(null); }}
                    onKeyDown={(e) => e.key === 'Enter' && resolvePromptSubmit()}
                  />
                  {promptError && <p className="text-xs text-danger mt-1.5">{promptError}</p>}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                {dialog.type === 'alert' && (
                  <button className="btn-primary" onClick={resolveAlert} autoFocus>{dialog.options?.okLabel || 'OK'}</button>
                )}
                {dialog.type === 'confirm' && (
                  <>
                    <button className="btn-secondary" onClick={() => resolveConfirm(false)}>{dialog.options?.cancelLabel || 'Cancel'}</button>
                    <button className={dialog.options?.danger ? 'btn-danger' : 'btn-primary'} onClick={() => resolveConfirm(true)} autoFocus>
                      {dialog.options?.confirmLabel || 'Confirm'}
                    </button>
                  </>
                )}
                {dialog.type === 'prompt' && (
                  <>
                    <button className="btn-secondary" onClick={resolvePromptCancel}>{dialog.options?.cancelLabel || 'Cancel'}</button>
                    <button className="btn-primary" onClick={resolvePromptSubmit}>{dialog.options?.confirmLabel || 'OK'}</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}
