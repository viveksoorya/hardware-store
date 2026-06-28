import { checkLicense } from './license.js'
import { getShopFromURL } from './shops.js'
import { initState } from './state.js'
import { renderAll, applyShopConfig } from './ui/index.js'

const config = getShopFromURL()
initState(config)
applyShopConfig(config)

checkLicense('hardware-store').then(result => {
  if (!result.blocked) {
    renderAll()
  }
})
