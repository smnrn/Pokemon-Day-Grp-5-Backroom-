import { useEffect, useRef } from "react"
import type { MotionValue } from "motion/react"
import { SILHOUETTES } from "./landing-model"

export function LandingCanvas({
  x,
  y,
  active,
  breach,
}: {
  x: MotionValue<number>
  y: MotionValue<number>
  active: boolean
  breach: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext("2d", { alpha: false })
    if (!element || !context) return
    const background = document.createElement("canvas")
    const lore = document.createElement("canvas")
    const reveal = document.createElement("canvas")
    const base = background.getContext("2d")
    const hidden = lore.getContext("2d")
    const light = reveal.getContext("2d")
    if (!base || !hidden || !light) return
    const paths = Object.entries(SILHOUETTES).map(([id, path]) => ({
      id,
      path: new Path2D(path),
    }))
    let width = 0,
      height = 0,
      ratio = 1,
      frame = 0
    const ink = getComputedStyle(element)
    const yellow = ink.getPropertyValue("--c-yellow").trim() || "#e5c158"
    const red = ink.getPropertyValue("--c-red").trim() || "#ee7771"
    function resize() {
      width = window.innerWidth
      height = window.innerHeight
      ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      for (const layer of [element!, background, lore]) {
        layer.width = Math.round(width * ratio)
        layer.height = Math.round(height * ratio)
      }
      const diameter = Math.min(width * 0.48, 380) * 2
      reveal.width = Math.round(diameter * ratio)
      reveal.height = Math.round(diameter * ratio)
      base!.setTransform(ratio, 0, 0, ratio, 0, 0)
      hidden!.setTransform(ratio, 0, 0, ratio, 0, 0)
      base!.fillStyle = "#090d0c"
      base!.fillRect(0, 0, width, height)
      const ambience = base!.createRadialGradient(
        width * 0.25,
        height * 0.4,
        0,
        width * 0.3,
        height * 0.5,
        width * 0.8,
      )
      ambience.addColorStop(0, "#1c241d")
      ambience.addColorStop(0.5, "#101613")
      ambience.addColorStop(1, "#080b0a")
      base!.fillStyle = ambience
      base!.fillRect(0, 0, width, height)
      // Deterministic grain is cached at resize, rather than generated every frame.
      for (let i = 0; i < (width * height) / 115; i++) {
        const px = (i * 97.31) % width,
          py = (i * 61.77) % height
        base!.fillStyle = i % 3 ? "#d8ddbf05" : "#00000018"
        base!.fillRect(px, py, 1.2, 1.2)
      }
      base!.strokeStyle = "#c5d6ac09"
      base!.lineWidth = 0.6
      for (let px = 0; px < width; px += 72) {
        base!.beginPath()
        base!.moveTo(px, 0)
        base!.lineTo(px, height)
        base!.stroke()
      }
      for (let py = 0; py < height; py += 72) {
        base!.beginPath()
        base!.moveTo(0, py)
        base!.lineTo(width, py)
        base!.stroke()
      }
      hidden!.clearRect(0, 0, width, height)
      hidden!.strokeStyle = "#b1a15740"
      hidden!.lineWidth = 1
      // A faded, repeating botanical diamond pattern evokes the yellow wallpaper.
      for (let px = 0; px < width; px += 58) {
        for (let py = 0; py < height; py += 90) {
          hidden!.beginPath()
          hidden!.moveTo(px + 28, py + 6)
          hidden!.bezierCurveTo(
            px - 5,
            py + 40,
            px + 14,
            py + 47,
            px + 28,
            py + 80,
          )
          hidden!.bezierCurveTo(
            px + 42,
            py + 47,
            px + 60,
            py + 40,
            px + 28,
            py + 6,
          )
          hidden!.moveTo(px + 28, py + 20)
          hidden!.lineTo(px + 28, py + 65)
          hidden!.stroke()
        }
      }
      hidden!.font = "11px 'IBM Plex Mono', monospace"
      hidden!.fillStyle = "#d0c27d99"
      const formulas = [
        "arg min Σ ||xᵢ − μₖ||²",
        "SECTOR 04 / THEY ADAPT",
        "μₖ = (1/|Cₖ|) Σ xᵢ",
        "#094: DO NOT LOOK AWAY",
        "P(escape|x) = σ(βᵀx)",
        "SILPH INTERNAL / 1998",
      ]
      formulas.forEach((text, index) => {
        hidden!.save()
        hidden!.translate(
          width * (0.08 + (index % 3) * 0.31),
          height * (0.2 + Math.floor(index / 3) * 0.56),
        )
        hidden!.rotate(index % 2 ? -0.07 : 0.035)
        hidden!.fillText(text, 0, 0)
        hidden!.restore()
      })
      hidden!.strokeStyle = "#dd363988"
      hidden!.lineWidth = 2.4
      for (let i = 0; i < 4; i++) {
        const px = width * 0.76 + i * 13,
          py = height * 0.47
        hidden!.beginPath()
        hidden!.moveTo(px, py)
        hidden!.quadraticCurveTo(px - 22, py + 40, px - 11, py + 107)
        hidden!.stroke()
      }
      if (!active) render(0)
    }
    function render(time: number) {
      context!.setTransform(ratio, 0, 0, ratio, 0, 0)
      context!.globalAlpha = 1
      context!.drawImage(background, 0, 0, width, height)
      const px = x.get(),
        py = y.get(),
        radius = Math.min(width * 0.48, 380)
      light!.setTransform(ratio, 0, 0, ratio, 0, 0)
      light!.globalCompositeOperation = "source-over"
      light!.clearRect(0, 0, radius * 2, radius * 2)
      light!.save()
      light!.translate(radius - px, radius - py)
      light!.globalAlpha = breach ? 0.68 : 0.4
      light!.drawImage(lore, 0, 0, width, height)
      paths.forEach((specimen, index) => {
        const sx = width * (0.18 + index * 0.31),
          sy = height * (0.32 + (index % 2) * 0.35)
        const distance = Math.hypot(px - sx, py - sy)
        // Getting too close makes the specimen disappear instead of chasing the form.
        const opacity = Math.min(0.45, Math.max(0, (distance - 70) / 500))
        light!.save()
        light!.translate(
          sx - 80 + (active ? Math.sin(time * 0.025 + index) * 2 : 0),
          sy - 90,
        )
        light!.globalAlpha = opacity * 0.8
        light!.fillStyle = index === 1 ? "#8e6ab0" : yellow
        light!.fill(specimen.path)
        light!.font = "9px monospace"
        light!.fillText(`#${specimen.id} / SIGNAL LOST`, 7, 190)
        light!.restore()
      })
      light!.restore()
      light!.globalAlpha = 1
      light!.globalCompositeOperation = "destination-in"
      const mask = light!.createRadialGradient(
        radius,
        radius,
        0,
        radius,
        radius,
        radius,
      )
      mask.addColorStop(0, "#fff")
      mask.addColorStop(0.3, "#ffffffdd")
      mask.addColorStop(0.72, "#ffffff44")
      mask.addColorStop(1, "#ffffff00")
      light!.fillStyle = mask
      light!.fillRect(0, 0, radius * 2, radius * 2)
      context!.drawImage(
        reveal,
        px - radius,
        py - radius,
        radius * 2,
        radius * 2,
      )
      const glow = context!.createRadialGradient(px, py, 0, px, py, radius)
      glow.addColorStop(0, "#e3df9a0b")
      glow.addColorStop(0.4, "#e3df9a05")
      glow.addColorStop(1, "#e3df9a00")
      context!.fillStyle = glow
      context!.fillRect(px - radius, py - radius, radius * 2, radius * 2)
      if (breach) {
        context!.fillStyle = active
          ? `rgba(154,23,28,${0.09 + Math.sin(time * 0.004) * 0.035})`
          : "#921b1b18"
        context!.fillRect(0, 0, width, height)
      }
      context!.strokeStyle = breach ? red : "#d9d5a555"
      context!.lineWidth = 0.7
      context!.beginPath()
      context!.moveTo(px - 11, py)
      context!.lineTo(px - 4, py)
      context!.moveTo(px + 4, py)
      context!.lineTo(px + 11, py)
      context!.moveTo(px, py - 11)
      context!.lineTo(px, py - 4)
      context!.moveTo(px, py + 4)
      context!.lineTo(px, py + 11)
      context!.stroke()
      if (active && !document.hidden) frame = requestAnimationFrame(render)
    }
    function visibility() {
      cancelAnimationFrame(frame)
      if (!document.hidden) frame = requestAnimationFrame(render)
    }
    resize()
    if (active) frame = requestAnimationFrame(render)
    window.addEventListener("resize", resize)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [active, breach, x, y])
  return (
    <canvas ref={canvas} className="l-background-canvas" aria-hidden="true" />
  )
}
