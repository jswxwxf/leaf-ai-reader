import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Leaf AI Reader",
	description: "极简、高效的智能 EPUB 阅读器",
};

import { FullScreenLoading } from "@/app/full-screen-loading";
import { PropsWithChildren } from "react";
import { GlobalModals } from "./global-modals";

export default function RootLayout({
	children,
}: Readonly<PropsWithChildren>) {
	return (
		<html lang="en" data-theme="light">
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
			</head>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<div>
					{children}
				</div>
				<FullScreenLoading />
				<GlobalModals />
			</body>
		</html>
	);
}
