// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
	site: 'https://zats.io',
	integrations: [mdx(), sitemap()],
	devToolbar: {
		enabled: false
	},
	markdown: {
		syntaxHighlight: 'shiki',
		shikiConfig: {
			themes: {
				light: 'github-light',
				dark: 'github-dark'
			}
		}
	},
});
