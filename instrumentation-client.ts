// Lightweight client-side analytics bootstrap (optional)
// Initializes PostHog early if a public key is configured.

if (typeof window !== 'undefined') {
	const key = process.env.NEXT_PUBLIC_POSTHOG_KEY as string | undefined;
	if (key) {
		let shouldBootstrap = true;
		try {
			const wph = (window as any).posthog;
			if (wph && (wph.__loaded || wph.capture)) {
				// Already initialized via snippet; skip dynamic bootstrap
				shouldBootstrap = false;
			}
		} catch {}
		// Import dynamically to avoid SSR bundles including posthog-js by default
		if (shouldBootstrap) {
			import('posthog-js').then(({ default: posthog }) => {
				const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST as string | undefined) || '/ph';
				try {
					posthog.init(key, {
						api_host: host,
						capture_pageview: false,
						mask_all_text: true,
						mask_all_element_attributes: true,
						persistence: 'localStorage+cookie',
						person_profiles: 'identified_only'
					});
				} catch {}
			});
		}
	}
}