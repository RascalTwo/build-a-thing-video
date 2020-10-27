// Variables related to background settings, higher performance gained by
// defining them as globals instead of packaging within objects.
let [darkestR, darkestG, darkestB] = [0, 30, 0];
let [lightestR, lightestG, lightestB] = [0, 255, 0];
let chromaTolerance = 0.05 * 255 * 3;

let backgroundX = 0;
let backgroundY = 0;

// Background image ImageData
let backgroundPixels = null;
let backgroundWidth = 0;
let backgroundHeight = 0;

let checkChroma = true;


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
			: 0;


/**
 * Convert hexcode color to RGB
 *
 * From https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
 */
const hexToRGB = hex => {
	if (hex[0] == '#') hex = hex.substring(1);
	const bigint = parseInt(hex, 16);
	const r = (bigint >> 16) & 255;
	const g = (bigint >> 8) & 255;
	const b = bigint & 255;

	return [r, g, b];
}

const ACTIONS = {
	// Remove the background image entirely
	removeBackgroundImage: () => {
		backgroundPixels = null;
		backgroundWidth = 0;
		backgroundHeight = 0;
	},
	// Set the background image
	setBackgroundImage: ({ buffer, width, height }) => {
		const imageData = new ImageData(new Uint8ClampedArray(buffer), width, height);
		backgroundPixels = imageData.data;
		backgroundWidth = imageData.width;
		backgroundHeight = imageData.height;
	},
	// Update a background image related setting
	updateBackgroundSettings: ({ key, value }) => {
		switch(key){
			case 'x':
				backgroundX = value;
				break;
			case 'y':
				backgroundY = value;
				break;
			case 'previewOverlay':
				checkChroma = !value;
				break;
			case 'tolerance':
				chromaTolerance = value * 255 * 3;
				break;
			case 'darkestChroma':
			case 'lightestChroma':
				const [r, g, b] = hexToRGB(value);
				if (key == 'darkestChroma') ([darkestR, darkestG, darkestB] = [r, g, b])
				else if (key === 'lightestChroma') ([lightestR, lightestG, lightestB] = [r, g, b])
				break;
			default:
				console.error(`Unexpected background setting key: ${key}`);
		}
	},
	// Apply the greenscreen effect to the provided imagedata
	applyGreenscreenEffect: ({ buffer, width, height }) => {
		const foregroundPixels = new Uint8ClampedArray(buffer);

		const length = backgroundPixels.length / 4;
		for (let i = 0; i < length; i++){
			const x = (i % backgroundWidth) + backgroundX;
			const y = ~~(i / backgroundWidth) + backgroundY;
			const foregroundI = y * (width * 4) + x * 4;
			if (checkChroma && (
					distanceBetween(foregroundPixels[foregroundI], darkestR, lightestR) +
					distanceBetween(foregroundPixels[foregroundI + 1], darkestG, lightestG) +
					distanceBetween(foregroundPixels[foregroundI + 2], darkestB, lightestB)
					>= chromaTolerance
				)
			) continue;
			// Override with background pixel

			// Despite the expectancy:
			//   foregroundPixels.set(backgroundPixels.slice(i, i + 4), foregroundI);
			// does not offer better performance
			const i4 = i * 4;
			foregroundPixels[foregroundI] = backgroundPixels[i4];
			foregroundPixels[foregroundI + 1] = backgroundPixels[i4 + 1];
			foregroundPixels[foregroundI + 2] = backgroundPixels[i4 + 2];
		}
		self.postMessage({
			buffer: foregroundPixels.buffer,
			width, height
		}, [foregroundPixels.buffer]);
	}
}

self.addEventListener('message', event => {
	const { action } = event.data;

	// Call action function if it exists, otherwise log it
	// Local tests show this object-map has higher performance then switch-case and if-else
	if (ACTIONS[action]) ACTIONS[action](event.data.data);
	else console.error(`Unknown action: ${action}`);
});
