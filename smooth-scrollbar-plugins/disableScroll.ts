import { ScrollbarPlugin } from '@tinokaartovuori/smooth-scrollbar'
import type { Data2d } from '@tinokaartovuori/smooth-scrollbar/interfaces'

class disableScroll extends ScrollbarPlugin {
  static pluginName = 'disableScroll'
  static defaultOptions = {
    direction: null,
  }

  transformDelta(t: Data2d) {
    this.options.getDelta && this.options.getDelta(t)
    // idk what 1e-12 is xd more info maybe in https://mathjs.org/docs/datatypes/units.html
    this.options.lock && ((t.x = 1e-12), (t.y = 1e-12))

    return t
  }

  onRender(t: any) {}
}

export default disableScroll
