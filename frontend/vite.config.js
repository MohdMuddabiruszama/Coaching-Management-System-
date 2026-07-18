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
    const isMobileBuild = ['student', 'parent', 'faculty', 'universal'].includes(
        String(variant).toLowerCase()
    )

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
        // ── Production Build Optimisation ─────────────────────────────────
        build: {
            // Raise chunk warning threshold slightly for large pages (PricingPage, etc.)
            chunkSizeWarningLimit: 600,
            rollupOptions: {
                output: {
                    /**
                     * Manual chunk splitting — browsers cache vendor chunks across deploys.
                     * Only changed app chunks are re-downloaded on each release.
                     * Skipped for mobile builds (Capacitor uses ./ base, not CDN).
                     */
                    ...(isMobileBuild ? {} : {
                        manualChunks: {
                            // Core React runtime — changes rarely
                            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                            // Chart/data-viz libraries — large, rarely change
                            'vendor-charts': ['chart.js', 'react-chartjs-2', 'recharts'],
                            // PDF export — heavy, rarely used
                            'vendor-pdf': ['jspdf', 'jspdf-autotable'],
                            // Real-time socket — isolated chunk
                            'vendor-socket': ['socket.io-client'],
                            // QR code libraries
                            'vendor-qr': ['qrcode', 'qrcode.react'],
                        },
                    }),
                },
            },
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

