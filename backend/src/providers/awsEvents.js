// Parser for the AWS binary event-stream format (Bedrock). Each message is:
// total length (4 bytes), headers length (4), prelude CRC (4), headers, payload, message CRC (4).
// Yields {headers, payload} with the payload parsed as JSON.
const PRELUDE_LENGTH = 12;
const MESSAGE_CRC_LENGTH = 4;

// Header value types from the event-stream spec.
const HEADER_TYPE = {
  BOOLEAN_TRUE: 0,
  BOOLEAN_FALSE: 1,
  BYTE: 2,
  SHORT: 3,
  INTEGER: 4,
  LONG: 5,
  BYTE_ARRAY: 6,
  STRING: 7,
  TIMESTAMP: 8,
  UUID: 9,
};
const UUID_LENGTH = 16;

// Reads one header value at `offset`; returns the value and the offset just after it.
function readHeaderValue(bytes, view, decoder, type, offset) {
  switch (type) {
    case HEADER_TYPE.BOOLEAN_TRUE:
      return { value: true, nextOffset: offset };
    case HEADER_TYPE.BOOLEAN_FALSE:
      return { value: false, nextOffset: offset };
    case HEADER_TYPE.BYTE:
      return { value: view.getInt8(offset), nextOffset: offset + 1 };
    case HEADER_TYPE.SHORT:
      return { value: view.getInt16(offset), nextOffset: offset + 2 };
    case HEADER_TYPE.INTEGER:
      return { value: view.getInt32(offset), nextOffset: offset + 4 };
    case HEADER_TYPE.LONG:
    case HEADER_TYPE.TIMESTAMP:
      return { value: view.getBigInt64(offset), nextOffset: offset + 8 };
    case HEADER_TYPE.BYTE_ARRAY:
    case HEADER_TYPE.STRING: {
      const valueLength = view.getUint16(offset);
      const valueStart = offset + 2;
      const rawValue = bytes.subarray(valueStart, valueStart + valueLength);
      let value = rawValue;
      if (type === HEADER_TYPE.STRING) {
        value = decoder.decode(rawValue);
      }
      return { value, nextOffset: valueStart + valueLength };
    }
    case HEADER_TYPE.UUID:
      return {
        value: bytes.subarray(offset, offset + UUID_LENGTH),
        nextOffset: offset + UUID_LENGTH,
      };
    default:
      throw new Error(`Unknown event-stream header type ${type}`);
  }
}

function readHeaders(bytes) {
  const headers = {};
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset < bytes.length) {
    const nameLength = bytes[offset];
    offset += 1;
    const name = decoder.decode(bytes.subarray(offset, offset + nameLength));
    offset += nameLength;
    const type = bytes[offset];
    offset += 1;
    const { value, nextOffset } = readHeaderValue(bytes, view, decoder, type, offset);
    offset = nextOffset;
    headers[name] = value;
  }
  return headers;
}

function appendBytes(existing, chunk) {
  const combined = new Uint8Array(existing.length + chunk.length);
  combined.set(existing);
  combined.set(chunk, existing.length);
  return combined;
}

export async function* awsEvents(body) {
  let buffered = new Uint8Array(0);
  const decoder = new TextDecoder();
  for await (const chunk of body) {
    buffered = appendBytes(buffered, chunk);
    while (buffered.length >= PRELUDE_LENGTH) {
      const view = new DataView(buffered.buffer, buffered.byteOffset, buffered.byteLength);
      const totalLength = view.getUint32(0);
      const headersLength = view.getUint32(4);
      if (buffered.length < totalLength) {
        break;
      }
      const headersEnd = PRELUDE_LENGTH + headersLength;
      const headers = readHeaders(buffered.subarray(PRELUDE_LENGTH, headersEnd));
      const payloadEnd = totalLength - MESSAGE_CRC_LENGTH;
      const payloadText = decoder.decode(buffered.subarray(headersEnd, payloadEnd));
      buffered = buffered.slice(totalLength);
      let payload = {};
      if (payloadText) {
        payload = JSON.parse(payloadText);
      }
      yield { headers, payload };
    }
  }
}
