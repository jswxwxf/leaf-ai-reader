import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

// 配置自定义中文字体
const customFont = localFont({
	src: "../../public/AaBiaoTiChuYuan.woff2",
	variable: "--font-custom",
	display: "swap",
});

export const metadata: Metadata = {
	title: "Leaf AI Reader",
	description: "极简、高效的智能 EPUB 阅读器",
	referrer: 'no-referrer'
};

import { FullScreenLoading } from "@/app/full-screen-loading";
import { PropsWithChildren } from "react";
import { GlobalModals } from "@/app/global-modals";

type Props = PropsWithChildren<{
	reader: React.ReactNode;
}>;

export default function RootLayout({
	children,
	reader,
}: Props) {
	return (
		<html lang="zh" data-theme="light" className={`${customFont.variable}`}>
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
			</head>
			<body className={`${geistSans.variable} ${geistMono.variable} ${customFont.className} antialiased`}>
				<div>
					{children}
				</div>
				{reader}
				<FullScreenLoading />
				<GlobalModals />
			</body>
		</html>
	);
}
