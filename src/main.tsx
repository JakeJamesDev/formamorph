import { createRoot } from 'react-dom/client'
import App from './App'
import './fonts'
import './index.css'
import './lib/buildInfo'
import { trackDevicePixelRatio } from './lib/devicePixelGrid'

trackDevicePixelRatio()
if (import.meta.env.DEV && import.meta.env.VITE_FM_HOLD_UPDATES) void import('./lib/dev/heldUpdatesBanner')

createRoot(document.getElementById('root')!).render(

    <App />
)
