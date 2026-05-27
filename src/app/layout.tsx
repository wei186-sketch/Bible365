import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bible365 打卡",
  description: "365天读经音频打卡",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
