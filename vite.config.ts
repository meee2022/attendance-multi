import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Puts the built stylesheet inside index.html. Some school web filters block
 * the separate /assets/*.css file, leaving the app unstyled.
 */
function inlineCss(): Plugin {
  return {
    name: 'inline-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = Object.values(bundle).find(f => f.type === 'asset' && f.fileName === 'index.html')
      if (!html || html.type !== 'asset') return
      let source = String(html.source)
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue
        const tag = source.match(/<link[^>]*rel="stylesheet"[^>]*>/g)?.find(t => t.includes(`/${file.fileName}"`))
        if (!tag) continue
        source = source.replace(tag, () => `<style>${String(file.source)}</style>`)
        delete bundle[file.fileName]
      }
      html.source = source
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), inlineCss()],
})
