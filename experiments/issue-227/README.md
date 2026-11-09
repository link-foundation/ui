# Translucent SVG/PNG pixel probe

Start `node scripts/serve-static.mjs --port 4173`, then run
`node experiments/issue-227/pixel-probe.mjs` with the repository's WebKit browser
installed. The probe compares the same SVG decoded directly and after the
presentation's PNG encoder, reporting premultiplied RGB and alpha differences.
It uses one 96×64 scene and retains at most 15 differing pixels.

WebKit's translucent RGB encoding/decoding introduced a maximum painted RGB
error of 1.208 out of 255, with identical alpha. The browser regression test
therefore allows two 8-bit RGB levels and one alpha level. Opaque backgrounds
matched directly. This quantization does not change the shared SVG markup.
