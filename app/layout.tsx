import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '工厂管理系统',
  description: '辅料 · 布料 · 财务一体化管理',
  icons: {
    icon: '/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1D9E75',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {/* SW 狙击代码 - 主动卸载历史 sw + 清缓存，确保受感染的设备访问后立刻恢复 */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(regs){
                  regs.forEach(function(r){ r.unregister(); });
                });
              }
              if ('caches' in window) {
                caches.keys().then(function(keys){
                  keys.forEach(function(k){ caches.delete(k); });
                });
              }
            } catch(e) {}
          })();
        `}} />
        {children}
      </body>
    </html>
  );
}
