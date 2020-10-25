let background = {
	x: 0,
	y: 0,
	darkestChroma: [0, 30, 0],
	lightestChroma: [0, 255, 0],
	tolerance: 0.05,
	overlay: false,
	image: null
};

/**
 * Convert RGB to HSL
 *
 * From https://css-tricks.com/converting-color-spaces-in-javascript/
 */
const RGBtoHSL = (r, g, b) => {
	r /= 255;
	g /= 255;
	b /= 255;

	const cmin = Math.min(r,g,b);
	const cmax = Math.max(r,g,b);
	let delta = cmax - cmin;

	let [h, s, l] = [0, 0, 0];
	if (delta == 0) h = 0;
	else if (cmax == r) h = ((g - b) / delta) % 6;
	else if (cmax == g) h = (b - r) / delta + 2;
	else h = (r - g) / delta + 4;

	h = Math.round(h * 60);
	if (h < 0) h += 360;
	l = (cmax + cmin) / 2;
	s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
	s = +(s * 100).toFixed(1);
	l = +(l * 100).toFixed(1);

	return [h, s, l];
}

const shouldReplaceRGB = (r, g, b) => {
	const [lr, lg, lb] = background.lightestChroma;
	const [dr, dg, db] = background.darkestChroma;
	return (
		distanceBetween(r, dr, lr) +
		distanceBetween(g, dg, lg) +
		distanceBetween(b, db, lb)
	) / (255 * 3) < background.tolerance;
}

const distanceBetween = (value, min, max) => {
	if (value < min) return min - value;
	if (value > max) return value - max;
	return 0;
}

const ACTIONS = {
	removeBackgroundImage: () => {
		background = { ...background, image: null }
	},
	setBackgroundImage: ({ pixels, width, height }) => {
		background = {
			...background,
			image: new ImageData(new Uint8ClampedArray(pixels), width, height)
		};
	},
	updateBackground: update => {
		background = { ...background, ...update};
	},
	applyGreenscreenEffect: ({ pixels: rawPixels, width, height }) => {
		const pixels = new Uint8ClampedArray(rawPixels);

		const bgPixels = background.image.data;
		const bgWidth = background.image.width;
		for (let i = 0; i < bgPixels.length; i += 4){
			// x and y of pixel to take from background image
			// Ensure both are within bounds
			const x = ((i/4) % bgWidth) + background.x;
			if (x < 0 || x >= width) continue;

			const y = Math.floor((i / 4) / bgWidth) + background.y;
			if (y < 0 || y >= height) continue;

			const fgI = y * (width * 4) + x * 4;
			if (!background.overlay){
				// Check if the current pixel should be overriden with background
				if (!shouldReplaceRGB(pixels[fgI], pixels[fgI + 1], pixels[fgI + 2])) continue;
			}

			// Override with background pixel
			pixels[fgI] = bgPixels[i];
			pixels[fgI + 1] = bgPixels[i + 1];
			pixels[fgI + 2] = bgPixels[i + 2];
			pixels[fgI + 3] = bgPixels[i + 3];
		}
		self.postMessage(pixels.buffer, [pixels.buffer]);
	}
}

self.addEventListener('message', event => {
	const { action, data } = event.data;

	if (ACTIONS[action]) ACTIONS[action](data);
	else console.error(`Unknown action: ${action}`);
});
