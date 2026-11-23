# Prompt 34 · Image input

Send image bytes with a text question in one SDK user message and inspect the actual visual explanation.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43134. Run `npm run agent` for the original-infographic query or `npm run agent -- wrong-mime` for the deliberate local validation error. Run `npm run typecheck` and `npm test` for the offline checks.

The default image is the original Prompt 34 main infographic. The same asset is reused as the lesson's first infographic slide. You can also select a local PNG or JPEG and enter a different question. This classroom application accepts up to 5 MiB of decoded image bytes. Provider and model limits are documented separately in the linked vision reference.

## Image and text in one message

The asynchronous input generator yields an SDKUserMessage with two content blocks. The first is an image whose source has type base64, a validated image/png or image/jpeg media_type, and the raw base64 bytes in data. The second is a text block containing the user's question. The query consumes this image-bearing asynchronous input.

The browser reads a selected file as a data URL, retains the MIME type, and removes the data-URL prefix before sending the base64 payload to the server. Server validation checks supported media types, encoded and decoded size, canonical base64 encoding, and the matching PNG or JPEG format header. The provider handles full image decoding. The original image's bytes and hash are preserved in the report metadata.

The query's system prompt treats text inside the image as visual content to describe. Tools, MCP servers, and filesystem setting sources are empty. The application consumes actual SDK output and preserves the final answer, native session ID, observed message frame types, and image input metadata. The report omits the base64 payload. The selected image is saved separately under the local run directory and served back for the matching report preview.

## Verify the actual default image

The default question asks the model to read the title, explain the diagram and visual design, and identify the code fragment. The classroom check looks for the actual Prompt 34 title and its image-input, user-message, agent, and base64 concepts. The live CLI correctly read the title and described the Image → User message → Agent flow and image content block.

That limited classroom content check applies to the original demo source and unchanged default question. Uploaded images and custom questions record a null classroomContentCheck and require review of their actual visual answers. SDK completion and a nonempty returned explanation are checked for those runs. The UI labels that content check as Review visual answer.

The browser verification uploads the original PNG through the file picker, confirms that its hash matches the original, and verifies the saved image endpoint returns the exact submitted bytes. Source switching restores the corresponding selected preview. Saved uploaded-image reports show their own saved image, and the interface asks for a local file when starting another uploaded-image run after restoring such a report.

## Deliberate MIME error and repair

Wrong-mime mode pairs the original PNG bytes with a JPEG media type. The format-header guard raises MIME_MISMATCH before query creation. Restore the original PNG input and run the real vision query again. An empty question is also rejected before creating a query.

Each query has a 90-second abort timeout, a one-turn agent-loop limit, and a USD 0.50 SDK budget limit. The finally block clears the timer and closes the query. The server accepts one active analysis at a time. Reports and selected images are stored locally under runs and downloadable through their report IDs.

## Exercise

Ask a different question about the same diagram, then analyze another supported image. Review the explanation against the actual visible content and inspect the image hash and MIME type. Trace the raw base64 payload from file selection to the image source block. Reproduce the media-type mismatch and restore a matching input.

The original infographic and branded cover are reused. Author: Luis Coco Enríquez.

## References

- [SDK image-bearing streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
- [Image formats and provider vision limits](https://platform.claude.com/docs/en/build-with-claude/vision)
- [TypeScript user-message types](https://code.claude.com/docs/en/agent-sdk/typescript)
