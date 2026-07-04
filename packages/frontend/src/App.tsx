import { Shell } from './shell/Shell'
import { pluginRegistry } from './plugins/registry'
import { newsPlugin } from './plugins/news/NewsPlugin'
import { rpiDesktopPlugin } from './plugins/rpi-desktop/RpiDesktopPlugin'
import { settingsPlugin } from './plugins/settings/SettingsPlugin'
import { investmentsPlugin } from './plugins/investments/InvestmentsPlugin'
import { homeAutomationPlugin } from './plugins/home-automation/HomeAutomationPlugin'
import { IdleMonitor } from './lib/idle-monitor'

pluginRegistry.register(newsPlugin)
pluginRegistry.register(investmentsPlugin)
pluginRegistry.register(homeAutomationPlugin)
pluginRegistry.register(rpiDesktopPlugin)
pluginRegistry.register(settingsPlugin)

export default function App() {
  return (
    <>
      <IdleMonitor />
      <Shell />
    </>
  )
}
