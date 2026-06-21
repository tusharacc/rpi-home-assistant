import { Shell } from './shell/Shell'
import { pluginRegistry } from './plugins/registry'
import { newsPlugin } from './plugins/news/NewsPlugin'
import { rpiDesktopPlugin } from './plugins/rpi-desktop/RpiDesktopPlugin'

pluginRegistry.register(newsPlugin)
pluginRegistry.register(rpiDesktopPlugin)

export default function App() {
  return <Shell />
}
