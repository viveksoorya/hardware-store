import { getShopFromURL } from './shops.js'
import { initState } from './state.js'
import { renderAll, applyShopConfig } from './ui/index.js'

const config = getShopFromURL()
initState(config)
applyShopConfig(config)
renderAll()
