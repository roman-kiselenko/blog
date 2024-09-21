const path = require("path");
const eleventyImage = require("@11ty/eleventy-img");

module.exports = eleventyConfig => {
	function relativeToInputPath(inputPath, relativeFilePath) {
		let split = inputPath.split("/");
		split.pop();

		return path.resolve(split.join(path.sep), relativeFilePath);
	}

	// eleventyConfig.addShortcode("gif", async function (src, alt, sizes) {
	// 	let metadata = await Image(src, {
	// 		widths: [300, 600],
	// 		formats: ["gif"],
	// 	});

	// 	let imageAttributes = {
	// 		alt,
	// 		sizes,
	// 		loading: "lazy",
	// 		decoding: "async",
	// 	};

	// 	// You bet we throw an error on a missing alt (alt="" works okay)
	// 	return Image.generateHTML(metadata, imageAttributes);
	// });
	// Eleventy Image shortcode
	// https://www.11ty.dev/docs/plugins/image/
	eleventyConfig.addAsyncShortcode("image", async function imageShortcode(src, alt, widths, sizes) {
		// await eleventyImage("./content/about/penguin_dance.gif", {
		// 	formats: ["webp", "gif"],


		// });

		// Full list of formats here: https://www.11ty.dev/docs/plugins/image/#output-formats
		// Warning: Avif can be resource-intensive so take care!
		let formats = ["gif", "avif", "webp", "auto"];
		let file = relativeToInputPath(this.page.inputPath, src);
		let metadata = await eleventyImage(file, {
			widths: widths || ["auto"],
			sharpOptions: {
				animated: true,
			},
			formats,
			outputDir: path.join(eleventyConfig.dir.output, "img"), // Advanced usage note: `eleventyConfig.dir` works here because we’re using addPlugin.
		});

		// TODO loading=eager and fetchpriority=high
		let imageAttributes = {
			alt,
			sizes,
			loading: "lazy",
			decoding: "async",
		};
		return eleventyImage.generateHTML(metadata, imageAttributes);
	});
};
