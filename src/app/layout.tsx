import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import './globals.css';
import DialogHost from '@/components/DialogHost';

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ibm-plex-thai',
});

export const metadata: Metadata = {
  title: 'Carbon Calculator',
  description: '...',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={ibmPlexSansThai.variable}>
      <body className="font-sans">
        {children}
        {/* [เพิ่ม] กล่องแจ้งเตือน/ยืนยันกลางของทุกหน้า (แทน alert/confirm ของเบราว์เซอร์) */}
        <DialogHost />
      </body>
    </html>
  );
}