// Lightweight client-side analytics bootstrap (optional)
// Initializes PostHog early if a public key is configured.

if (typeof window !== 'undefined') {
	const key = process.env.NEXT_PUBLIC_POSTHOG_KEY as string | undefined;
	if (key) {
		// Import dynamically to avoid SSR bundles including posthog-js by default
		import('posthog-js').then(({ default: posthog }) => {
			const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST as string | undefined) || '/ingest';
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