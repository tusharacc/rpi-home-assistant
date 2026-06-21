import type { Plugin, PluginSubItem } from './types'

const plugins: Plugin[] = []

export const pluginRegistry = {
  register(plugin: Plugin): void {
    if (!plugins.find(p => p.id === plugin.id)) {
      plugins.push(plugin)
    }
  },

  getAll(): Plugin[] {
    return plugins
  },

  findItem(id: string): Plugin | PluginSubItem | undefined {
    for (const plugin of plugins) {
      if (plugin.id === id) return plugin
      if (plugin.subItems) {
        const sub = plugin.subItems.find(s => s.id === id)
        if (sub) return sub
      }
    }
    return undefined
  },
}
