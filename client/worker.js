// Variables related to background settings, higher performance gained by
// defining them as globals instead of packaging within objects.
let [darkestR, darkestG, darkestB] = [0, 30, 0]
let [lightestR, lightestG, lightestB] = [0, 255, 0]
let chromaTolerance = 0.05 * 255 * 3

let backgroundX = 0
let backgroundY = 0

// Background image ImageData
let backgroundPixels = null
let backgroundWidth = 0
let backgroundHeight = 0

let checkChroma = true


/**
 * Return the distance the value is outside of the provided range
 * @param {number} value Value to get the distance of
 * @param {number} low Least of range
 * @param {number} high Most of range
 */
const distanceBetween = (value, low, high) =>
	value < low
		? low - value
		: value > high
			? value - high
			: 0


/**
 * Convert hexcode color to RGB
 *
 * From https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
 */
const hexToRGB = hex => {
	if (hex[0] == '#') hex = hex.substring(1)
	const bigint = parseInt(hex, 16)
	const r = (bigint >> 16) & 255
	const g = (bigint >> 8) & 255
	const b = bigint & 255

	return [r, g, b]
}

const ACTIONS = {
	// Remove the background image entirely
	removeBackgroundImage: () => {
		backgroundPixels = null
		backgroundWidth = 0
		backgroundHeight = 0
	},
	// Set the background image
	setBackgroundImage: ({ buffer, width, height }) => {
		backgroundPixels = new Uint32Array(buffer)
		backgroundWidth = width
		backgroundHeight = height
	},
	// Update a background image related setting
	updateBackgroundSettings: ({ key, value }) => {
		switch(key) {
			case 'x':
				backgroundX = value
				break
			case 'y':
				backgroundY = value
				break
			case 'previewOverlay':
				checkChroma = !value
				break
			case 'tolerance':
				chromaTolerance = value * 255 * 3
				break
			case 'darkestChroma':
			case 'lightestChroma':
				const [r, g, b] = hexToRGB(value)
				if (key == 'darkestChroma') ([darkestR, darkestG, darkestB] = [r, g, b])
				else if (key === 'lightestChroma') ([lightestR, lightestG, lightestB] = [r, g, b])
				break
			default:
				console.error(`Unexpected background setting key: ${key}`)
		}
	},
	// Apply the greenscreen effect to the provided imagedata
	applyGreenscreenEffect: ({ buffer, width, height }) => {
		// RGBA becomes ABGR
		const fullForeground = new Uint32Array(buffer)

		for (let y = 0; y < backgroundHeight; y++) {
			for (let x = 0; x < backgroundWidth; x++) {
				const i = (y + backgroundY) * width + (x + backgroundX)
				if (checkChroma && (
						distanceBetween((fullForeground[i]) & 0xff, darkestR, lightestR) +
						distanceBetween((fullForeground[i] >> 8) & 0xff, darkestG, lightestG) +
						distanceBetween((fullForeground[i] >> 16) & 0xff, darkestB, lightestB)
						>= chromaTolerance
					)
				) continue
				// Override with background pixel
				fullForeground[i] = backgroundPixels[y * backgroundWidth + x]
				// To manipulate manually: ... = (a << 24) | (b << 16) | (g << 8) | r
			}
		}
		self.postMessage({
			buffer: fullForeground.buffer,
			width, height
		}, [fullForeground.buffer])
	}
}

self.addEventListener('message', event => {
	const { action } = event.data

	// Call action function if it exists, otherwise log it
	// Local tests show this object-map has higher performance then switch-case and if-else
	if (ACTIONS[action]) ACTIONS[action](event.data.data)
	else console.error(`Unknown action: ${action}`)
})
