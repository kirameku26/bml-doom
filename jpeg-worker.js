
const sourceCanvas = new OffscreenCanvas(320, 200);
const sourceCtx = sourceCanvas.getContext("2d");

const outputCanvas = new OffscreenCanvas(960, 540);
const outputCtx = outputCanvas.getContext("2d");

self.onmessage = async ({ data }) => {
  const { id, buffer } = data;

  try {
    const pixels = new Uint8ClampedArray(buffer);

    sourceCtx.putImageData(
      new ImageData(pixels, 320, 200),
      0,
      0
    );

    outputCtx.fillStyle = "black";
    outputCtx.fillRect(0, 0, 960, 540);

    outputCtx.imageSmoothingEnabled = false;
    outputCtx.drawImage(
      sourceCanvas,
      120, 0, 720, 540
    );

    const blob = await outputCanvas.convertToBlob({
      type: "image/jpeg",
      quality: 0.5,
    });

    const jpegBuffer = await blob.arrayBuffer();

    self.postMessage(
      { id, buffer: jpegBuffer },
      [jpegBuffer]
    );
  } catch (error) {
    self.postMessage({
      id,
      error: String(error),
    });
  }

self.onmessage = async ({ data }) => {
  const { id, buffer } = data;
  const t0 = performance.now();

  try {
    const pixels = new Uint8ClampedArray(buffer);

    sourceCtx.putImageData(
      new ImageData(pixels, 320, 200),
      0,
      0
    );

    outputCtx.fillStyle = "black";
    outputCtx.fillRect(0, 0, 960, 540);
    outputCtx.imageSmoothingEnabled = false;
    outputCtx.drawImage(sourceCanvas, 120, 0, 720, 540);

    const t1 = performance.now();

    const blob = await outputCanvas.convertToBlob({
      type: "image/jpeg",
      quality: 0.5,
    });

    const t2 = performance.now();
    const jpegBuffer = await blob.arrayBuffer();
    const t3 = performance.now();

    self.postMessage({
      id,
      buffer: jpegBuffer,
      stats: {
        draw: t1 - t0,
        encode: t2 - t1,
        total: t3 - t0,
      },
    }, [jpegBuffer]);

  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};

};