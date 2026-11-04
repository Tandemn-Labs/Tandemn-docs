// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Tandemn',
			favicon: '/favicon.png',
			sidebar: [
				{ label: 'Overview', slug: 'index' },
				{
					label: 'Architecture',
					items: [{ autogenerate: { directory: 'architecture' } }],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
				{
					label: 'Help',
					items: [{ autogenerate: { directory: 'others' } }],
				},
			],
		}),
	],
});
