import { createRoot } from 'react-dom/client'
import App from './App'
import './fonts'
import './index.css'
import './lib/buildInfo'
import { trackDevicePixelRatio } from './lib/devicePixelGrid'

trackDevicePixelRatio()

createRoot(document.getElementById('root')!).render(

    <App />
)
