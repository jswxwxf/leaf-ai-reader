import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
	experimental: {
		serverActions: {
			allowedOrigins: ['leaf-ai-reader.protected.app'],
		},
	},
};

export default nextConfig;
