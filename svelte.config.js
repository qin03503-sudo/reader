import adapter from 'svelte-adapter-bun';

const defaultTrustedOrigins = [
	'http://localhost:3000',
	'http://localhost:5173',
	'http://127.0.0.1:3000',
	'http://127.0.0.1:5173',
	'http://0.0.0.0:3000',
	'http://0.0.0.0:5173'
];

const envOrigins = (process.env.CSRF_TRUSTED_ORIGINS || '')
	.split(',')
	.map(s => s.trim())
	.filter(Boolean);

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			precompress: true
		}),
		csrf: {
			checkOrigin: true,
			trustedOrigins: [...defaultTrustedOrigins, ...envOrigins]
		}
	}
};

export default config;
