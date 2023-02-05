import { Shape } from 'three'

export class RoundedRectangleShape extends Shape {
  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    super()
    this.moveTo(x - width / 2, y - height / 2)
    this.lineTo(x - width / 2, y - height / 2 + height - radius)
    this.quadraticCurveTo(
      x - width / 2,
      y - height / 2 + height,
      x - width / 2 + radius,
      y - height / 2 + height,
    )
    this.lineTo(x - width / 2 + width - radius, y - height / 2 + height)
    this.quadraticCurveTo(
      x - width / 2 + width,
      y - height / 2 + height,
      x - width / 2 + width,
      y - height / 2 + height - radius,
    )
    this.lineTo(x - width / 2 + width, y - height / 2 + radius)
    this.quadraticCurveTo(
      x - width / 2 + width,
      y - height / 2,
      x - width / 2 + width - radius,
      y - height / 2,
    )
    this.lineTo(x - width / 2 + radius, y - height / 2)
    this.quadraticCurveTo(
      x - width / 2,
      y - height / 2,
      x - width / 2,
      y - height / 2 + radius,
    )
  }
}
