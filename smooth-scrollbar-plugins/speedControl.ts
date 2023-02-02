// Custom scrollbar plugin to control scrolling speed
// Free to use, no MIT license required
// Author: @tinokaartovuori

import { ScrollbarPlugin } from 'smooth-scrollbar'
import type { Data2d } from 'smooth-scrollbar/interfaces'

class SpeedControlPlugin extends ScrollbarPlugin {
  static pluginName = 'speedControl'

  static defaultOptions = {
    speed: 1,
    maxSpeed: 1200,
  }

  clamp(num: number, min: number, max: number) {
    return Math.min(Math.max(num, min), max)
  }

  transformDelta(delta: Data2d) {
    const { speed, maxSpeed } = this.options

    return {
      x: this.clamp(delta.x * speed, -maxSpeed, maxSpeed),
      y: this.clamp(delta.y * speed, -maxSpeed, maxSpeed),
    }
  }
}

export default SpeedControlPlugin
