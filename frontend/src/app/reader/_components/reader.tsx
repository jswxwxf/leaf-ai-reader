"use client";

import { Header } from "./header";
import { Chapters } from "./chapters";
import { Content } from "./content";
import { Highlights } from "./highlights";
import { Footer } from "./footer";

interface Props {
	isPopup?: boolean;
}

export function Reader({ isPopup = true }: Props) {
	return (
		<div className="flex flex-col h-screen bg-base-100 text-base-content overflow-hidden font-sans">
			<Header isPopup={isPopup} />

			{/* 中间主要区域 */}
			<main className="flex flex-1 overflow-hidden">
				<Chapters />

				<Content />

				<Highlights />
			</main>

			<Footer />
		</div>
	);
}
