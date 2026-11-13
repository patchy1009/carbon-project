import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai_Looped, Prompt } from 'next/font/google';
import './globals.css';
import DialogHost from '@/components/DialogHost';

// ฟอนต์หลักของทั้งเว็บคือ IBM Plex Sans Thai Looped (class: font-sans) สำหรับเนื้อหาและปุ่มต่าง ๆ
const ibmPlexSansThaiLooped = IBM_Plex_Sans_Thai_Looped({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
});

// ฟอนต์ Prompt สำหรับโลโก้ "Carbon Calculator" บน navbar (class: font-display)
const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-prompt',
});

export const metadata: Metadata = {
  title: 'Carbon Calculator',
  description: 'ระบบคำนวณคาร์บอนฟุตพรินต์องค์กรและจำลองโครงการ T-VER',
};

// โครงหน้าชั้นนอกสุดของทั้งเว็บ: กำหนดฟอนต์ และวางกล่องแจ้งเตือนกลาง
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${ibmPlexSansThaiLooped.variable} ${prompt.variable}`}>
      <body className="font-sans">
        {children}
        {/* กล่องแจ้งเตือน/ยืนยันกลางของทุกหน้า (แทน alert/confirm ของเบราว์เซอร์) */}
        <DialogHost />
      </body>
    </html>
  );
}