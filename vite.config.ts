import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
	plugins: [
		sveltekit(),
		tailwindcss(),
		viteCompression({ algorithm: 'brotliCompress' }),
		viteCompression({ algorithm: 'gzip' })
	],
	build: {
		minify: 'terser'
	},
	ssr: {
		noExternal: process.env.NODE_ENV === 'production' ? true : []
	}
});
