import { runtime, serverOrigin } from './env';

export const customFetch = async (request: Request) => {
  if (runtime === 'desktop') {
    console.log('intercept request', request);

    // Handle the request body - convert ReadableStream to string/object
    let bodyData = undefined;

    if (request.body) {
      const contentType = request.headers.get('Content-Type') || '';

      // Clone the request to avoid consuming the original stream
      const clonedRequest = request.clone();

      if (contentType.includes('application/json')) {
        // Parse JSON body
        const text = await clonedRequest.text();
        try {
          bodyData = JSON.parse(text);
        } catch (e) {
          console.warn('Could not parse request body', e);
          bodyData = text; // Fallback to text if parsing fails
        }
      } else if (contentType.includes('text/')) {
        // Handle text body
        bodyData = await clonedRequest.text();
      } else if (contentType.includes('multipart/form-data')) {
        // For form data, this is more complex, but we'll handle simple cases
        const formData = await clonedRequest.formData();
        bodyData = Object.fromEntries(formData.entries());
      } else {
        // For other types, try to get as text
        try {
          bodyData = await clonedRequest.text();
        } catch (e) {
          console.warn('Could not read request body', e);
        }
      }
    }

    const res = await window.ipcRenderer?.invoke('apiRequest', {
      method: request.method,
      path: request.url.replace(`${serverOrigin}`, ''),
      body: bodyData,
      headers: Object.fromEntries(request.headers.entries()),
    });
    console.log('ipc invoke res', res);
    return new Response(JSON.stringify(res), {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  return fetch(request);
};
