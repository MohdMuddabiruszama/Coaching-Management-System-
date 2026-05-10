import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolveMobileShell(variant) {
    const v = String(variant || '').toLowerCase()
    if (v === 'parent') return path.resolve(__dirname, 'src/routes/MobileParentRoutes.jsx')
    if (v === 'faculty') return path.resolve(__dirname, 'src/routes/MobileFacultyRoutes.jsx')
    if (v === 'student') return path.resolve(__dirname, 'src/routes/MobileStudentRoutes.jsx')
    if (v === 'universal') return path.resolve(__dirname, 'src/routes/WebAppRoutes.jsx')
    return path.resolve(__dirname, 'src/routes/MobileShellEmpty.jsx')
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const variant = env.VITE_APP_VARIANT || process.env.VITE_APP_VARIANT || ''
    return {
        plugins: [react()],
        resolve: {
            alias: {
                'mobile-shell': resolveMobileShell(variant),
            },
        },
        server: {
            port: 5173,
            strictPort: false,
        },
        // ── Vitest configuration ───────────────────────────────────────────
        test: {
            globals:     true,
            environment: 'jsdom',
            setupFiles:  ['./src/test-setup.js'],
            include:     ['src/__tests__/**/*.{test,spec}.{js,jsx}'],
            coverage: {
                provider: 'v8',
                reporter: ['text', 'json', 'html'],
                include:  ['src/**/*.{js,jsx}'],
                exclude:  [
                    'src/test-setup.js',
                    'src/__tests__/**',
                    'src/main.jsx',
                    'src/styles/**',
                    'src/themes/**',
                    'src/assets/**',
                ],
            },
        },
    }
})
