export const REQUEST_LIMITS = {
  bodyBytes: 64 * 1024,
  jsonDepth: 10,
  arrayItems: 100,
  objectKeys: 100,
  totalNodes: 1000,
  stringChars: 10000,
  keyChars: 100,
  formFields: 50,
  readTimeoutMs: 10000,
} as const;

export class PayloadError extends Error {
  constructor(message: string, readonly status = 413) { super(message); }
}

// Bound nesting before JSON.parse, including unknown/unused fields.
export function validateJson(text: string): unknown {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (const char of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') {
      if (++depth > REQUEST_LIMITS.jsonDepth) throw new PayloadError('JSON nesting exceeds 10 levels.');
    } else if (char === '}' || char === ']') depth--;
  }
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new PayloadError('Request body must contain valid JSON.', 400); }
  const stack = [value];
  let nodes = 0;
  while (stack.length) {
    const item = stack.pop();
    if (++nodes > REQUEST_LIMITS.totalNodes) throw new PayloadError('JSON exceeds 1000 total values.');
    if (typeof item === 'string' && item.length > REQUEST_LIMITS.stringChars) throw new PayloadError('A field exceeds 10000 characters.');
    if (Array.isArray(item)) {
      if (item.length > REQUEST_LIMITS.arrayItems) throw new PayloadError('An array exceeds 100 items.');
      stack.push(...item);
    } else if (item && typeof item === 'object') {
      const entries = Object.entries(item);
      if (entries.length > REQUEST_LIMITS.objectKeys) throw new PayloadError('An object exceeds 100 fields.');
      for (const [key, entry] of entries) {
        if (key.length > REQUEST_LIMITS.keyChars) throw new PayloadError('A field name exceeds 100 characters.');
        stack.push(entry);
      }
    }
  }
  return value;
}

export function validateFormData(form: FormData) {
  let count = 0;
  for (const [name, value] of form.entries()) {
    if (++count > REQUEST_LIMITS.formFields) throw new PayloadError('A form exceeds 50 fields.');
    if (name.length > REQUEST_LIMITS.keyChars) throw new PayloadError('A field name exceeds 100 characters.');
    if (typeof value !== 'string') throw new PayloadError('File uploads are not supported.');
    if (value.length > REQUEST_LIMITS.stringChars) throw new PayloadError('A field exceeds 10000 characters.');
    // React Flight's numbered multipart fields can contain encoded JSON.
    if (/^\d+$/.test(name) && /^[\s]*[\[{]/.test(value)) validateJson(value);
  }
}

async function boundedBody(request: Request): Promise<Uint8Array> {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > REQUEST_LIMITS.bodyBytes)) throw new PayloadError('Request body exceeds 64 KiB.');
  const encoding = request.headers.get('content-encoding');
  if (encoding && encoding.toLowerCase() !== 'identity') throw new PayloadError('Compressed request bodies are not supported.', 415);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new PayloadError('Request body took too long to receive.', 408)), REQUEST_LIMITS.readTimeoutMs); });
  try {
    while (true) {
      const result = await Promise.race([reader.read(), timeout]);
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > REQUEST_LIMITS.bodyBytes) throw new PayloadError('Request body exceeds 64 KiB.');
      chunks.push(result.value);
    }
  } catch (error) {
    // Do not await tee cancellation: the other request branch may not be read yet.
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally { clearTimeout(timer); }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export async function validateRequestPayload(request: Request, api: boolean) {
  const bytes = await boundedBody(request);
  if (!bytes.length) return;
  const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (type === 'application/json' || /^application\/[a-z0-9.+-]+\+json$/.test(type) || (!api && type === 'text/plain')) {
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new PayloadError('Request body must be valid UTF-8.', 400); }
    const value = validateJson(text);
    if (api && (!value || typeof value !== 'object' || Array.isArray(value))) throw new PayloadError('JSON request body must be an object.', 400);
  } else if (!api && ['multipart/form-data', 'application/x-www-form-urlencoded'].includes(type)) {
    let form: FormData;
    try { form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData(); }
    catch { throw new PayloadError('Invalid form body.', 400); }
    validateFormData(form);
  } else throw new PayloadError(api ? 'Use application/json. File uploads are not supported.' : 'Unsupported request body format.', 415);
}
