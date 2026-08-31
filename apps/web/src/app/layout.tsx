import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { SavedJobsProvider } from '@/lib/saved-jobs-context';
import { DialogProvider } from '@/lib/dialog-context';

export const metadata: Metadata = {
  title: 'Job Centre Uganda',
  description: "Uganda's transparent hiring marketplace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>
        <AuthProvider>
          <SavedJobsProvider>
            <DialogProvider>{children}</DialogProvider>
          </SavedJobsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
