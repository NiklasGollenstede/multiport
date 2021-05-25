
# Multiport — versatile high-level promise-based RPC connections

Transforms channels that semantically send messages into RPC ports that call functions, get their return values and can even use callbacks as argument or return values in either direction.


## Example

`server.js`:
```js
const Port = require('multiport');

new (require('ws').Server)(...).on('connection', async socket => {

    const port = new Port(socket, Port.WebSocket);

    if (!ok((await port.request('getCredentials')))) {
        return port.destroy();
    }

    port.addHandler('getData', request => data);

    port.ended.then(() => console.log('client disconnected'));
}
```

`client.js`:
```js
define([ 'multiport' ], Port => { // or window.Multiport without AMD

    const port = new Port(new WebSocket(...), Port.WebSocket);

    port.addHandler('getCredentials', () => credentials);

    document.onclick = async () => display((await port.request('getData')));

    port.ended.then(() => console.log('connection disrupted'));
});
```


## Installation

Install with `npm install multiport` and

- require in node.js: `const Port = require('multiport');`
- load in a script tag `<script src="node_modules/multiport/index.js"></script>` and use as `window.Multiport`
- use as ES module: `import Port from 'multiport';`
- use with your favorite module packer
- use in browser extensions


## API

This module primarily exposes a single class, wich is used to wrap the endpoints of the underlying channels.
The complete API of the `Port`, with JSDoc comments and TypeScript compatible types, can be seen at the top of [`./index.esm.js`](./index.esm.js).


## Value mapping

Multiport expects the PortAdapters and their underlying channels to be able to transmit all values that can be expressed in JSON.
Further capabilities are generally up to the implementation of the PortAdapter.
In addition to that, Multiport transparently performs some mapping before sending values and unmapping before presenting them to the application on the other end.
This affects direct function arguments and function return values. Nested values are not processed.\
Currently, the special value types are:

- `Error` objects: Error objects are JSONized as `{ }`, which is perfectly useless. Therefore, objects whose `.constructor.name` ends with `Error` are recreated as instances of the matching class in the target context (or `Error` if the specific class is not present) and their name, message, stack, fileName, lineNumber and columnNumber is set to the original values.
- Functions: a stub function is passed to the handler / as the return value on the other end. All arguments and (asynchronous) return values are passed according to the normal rules described here. Sending the same function over the same Port in either direction multiple times will result in the same stub on the other end, calls to `.addEventListener()`/`.removeEventListener()` should work as expected. The only major drawback is that neither the stub nor the original function can be garbage-collected until the Port is destroyed.


## Adapters

To work with different types of underlying channels, Muliport uses `PortAdapter`s. A class implementing `PortAdapter` is passed to the constructor of the `Port`, which instantiates it with the provided channel endpoint, and then uses the instance to send and receive messages.\
A few adapters for common channel types are included, others can be implemented by fulfilling the `PortAdapter` interface in [`./index.esm.js`](./index.esm.js).\
The predefined adapters are:

- `Port.WebSocket`: Wraps WebSockets
    - Uses JSON encoding
- `Port.MessagePort`: Wraps MessagePorts
    - Calls `.start()`
    - NOTE: As there is no 'close' event on MessagePorts, the application must take care to close BOTH ends of the channel
- `Port.node_Stream`: Wraps node.js DuplexSteams
    - Uses JSON encoding, reads and writes UTF-8 strings
    - `.destroy()`s the Port on 'end' or 'close' events
    - Always sends asynchronously (even if the Stream passes messages synchronously)
- `Port.web_ext_Port`: Wraps `browser`/`chrome.runtime.Port` objects in Chromium, Firefox and Opera extensions
