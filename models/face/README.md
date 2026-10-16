# Local face-framing detector

BlazeFace/MediaPipe face detection by Google, converted to TensorFlow.js by Vladimir Mandic.

Weights and topology are vendored from https://github.com/vladmandic/human/tree/main/models (`blazeface.json`, renamed `model.json`, and `blazeface.bin`). The converted four-output graph is reassembled into the original BlazeFace output layout, with coordinates scaled from the converted graph’s 256-pixel input to the decoder’s 128-pixel grid in `lib/server/framing.ts`.

Attribution: Google MediaPipe, TensorFlow.js model authors, and Vladimir Mandic. See LICENSE (MIT, Human distribution) and LICENSE-GOOGLE (Apache 2.0, TensorFlow.js model code). Only face bounding boxes are used; this model does not produce the app's skin measurements. All inference is local, with no model download at runtime and no additional photo recipients.
