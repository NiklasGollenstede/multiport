
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
- use with your favorite module packer
- use in browser extensions


## API

This module primarily exposes a single class, wich is used to wrap the endpoints of the underlying channels.
```js
class Port {

	/**
	 * Takes one end of a communication channel and prepares it to send and receive requests.
	 * @param  {any}     port     The low-level port object that is connected to the communication channel.
	 *                            Its only use is as the argument to `Adapter`.
	 * @param  {class}   Adapter  A simple adapter class to provide a common interface for different types
	 *                            of low level ports. This can ether be one of (for details see below)
	 *                                Port.WebSocket        for  browser WebSockets,
	 *                                Port.MessagePort      for  browser MessagePorts,
	 *                                Port.node_Stream      for  node.js DuplexSteams,
	 *                                Port.web_ext_Port     for  (browser/chrome).runtime.Port object in
	 *                                                           Chromium, Firefox and Opera extensions,
	 *                            or any other class that implements the PortAdapter interface.
	 * @return {Port}             The new Port instance.
	 */
	constructor(port, Adapter) { new Implementation(this, port, Adapter); }

	/**
	 * Adds a named message handler.
	 * @param  {string}    name     Optional. Non-empty name of this handler, which can be used
	 *                              by .request() and .post() to call this handler. Defaults to `handler`.name.
	 * @param  {RegExp}    names    Optional, instead of explicit name. Name wildcard: Messages with names that are
	 *                              not handled by a handler with a string name are handled by this handler if their
	 *                              name matches. The first argument to the handler will be the actual name.
	 * @param  {function}  handler  The handler function. It will be called with JSON-clones
	 *                              of all additional arguments provided to .request() or .post()
	 *                              and may return a Promise to asynchronously return a value.
	 * @param  {any}       thisArg  `this` to pass to the handler when called.
	 *                              If == null, it may be set by the PortAdapter.
	 * @return {MessageHandler}     Self reference for chaining.
	 * @throws {Error}              If a handler for `name` is already registered.
	 */
	addHandler(name, handler, thisArg) {
		this.handlers[name] = handler; return this;
	}

	/**
	 * Adds multiple named message handlers.
	 * @param  {string}        prefix    Optional prefix to prepend to all handler names specified in `handlers`.
	 * @param  {object|array}  handlers  Ether an array of named functions or an object with methods.
	 *                                   Array entries / object properties that are not functions are ignored.
	 * @param  {any}           thisArg   `this` to pass to the handler when called.
	 *                                   If == null, it may be set by the PortAdapter.
	 * @return {MessageHandler}          Self reference for chaining.
	 * @throws {Error}                   If there is already a handler registered for any `prefix` + handler.name;
	 *                                   no handlers have been added.
	 */
	addHandlers(prefix, handlers, thisArg) {
		for (handler of handlers) { this.addHandler(prefix + handler.name, handler, thisArg); } return this;
	}

	/**
	 * Removes a named handler.
	 * @param  {string|RegExp}   name  The name of the handler to be removed.
	 * @return {MessageHandler}        Self reference for chaining.
	 */
	removeHandler(name) {
		delete this.handlers[name]; return this;
	}

	/**
	 * Queries the existence of a named handler.
	 * @param  {string|RegExp}  name  The name of the handler to query.
	 * @return {bool}                 `true` iff a handler is listening on this port.
	 */
	hasHandler(name) {
		return !!this.handlers[name];
	}

	/**
	 * Calls a handler on the other end of this port and returns a Promise to its return value.
	 * @param  {object}  options  Optional, may be omitted.
	 *                            If specified, it will be passed as 4th argument to PortAdapter.send().
	 * @param  {string}  name     Name of the remote handler to call.
	 * @param  {...any}  args     Additional arguments whose JSON-clones are passed to the remote handler.
	 * @return {Promise}          Promise that rejects if the request wasn't handled or if the handler threw
	 *                            and otherwise resolves to the handlers return value.
	 */
	async request(name, ...args) {
		return other.handlers[name](...args);
	}

	/**
	 * Calls a handler on the other end of this port without waiting for its return value
	 * and without guarantee that a handler has in fact been called.
	 * @param  {object}  options  Optional, may be omitted.
	 *                            If specified, it will be passed as 4th argument to PortAdapter.send().
	 * @param  {string}  name     Name of the remote handler to call.
	 * @param  {...any}  args     Additional arguments whose JSON-clones are passed to the remote handler.
	 */
	post(name, ...args) {
		other.handlers[name](...args);
	}

	/**
	 * Experimental. Calls a handler on the other end with the specified arguments
	 * after the underlying connection was closed, right before `.ended` resolves.
	 * Has the same arguments and semantics as `.post()` Can for example be used to release resources.
	 */
	afterEnded(name, ...args) {
		this.ended.then(() => other.handlers[name](...args));
	}

	/**
	 * While the port is open, returns a frozen Promise that resolves when the Port gets .destroyed().
	 * After the port is closed, it returns `true` directly.
	 */
	get ended() {
		return this.connection.closed ? true : Promise(true);
	}

	/**
	 * Tells whether the currently synchronously handled message is a request or post.
	 * Can be useful when forwarding requests.
	 * @return {boolean}  If false, the current handler is called by a remote `.post()`,
	 *                    i.e. the return value of the handler is not used.
	 * @throws {Error}    If this Port is not currently in a synchronous call to a handler.
	 */
	isRequest() { }

	/**
	 * Experimental. May get removed. Releases a function that has been previously passed trough this port.
	 * Sending that function again will result in new stubs.
	 */
	releaseCallback(func) { }

	/**
	 * Destroys the Port instance and the underlying PortAdapter.
	 * Gets automatically called when the underlying port closes.
	 * After the instance is destroyed, all other methods on this instance will throw.
	 * Never throws and any further calls to .destroy() will be ignored.
	 */
	destroy() { !this.connection.closed && this.connection.close(); }
}
```

## Value mapping

Multiport expects the PortAdapters and their underlying channels to be able to transmit all values that can be expressed in JSON.
Further capabilities are generally up to the implementation of the PortAdapter.
In addition to that, Multiport transparently performs some mapping before sending values and unmapping before presenting them to the application on the other end.
This affects direct function arguments and function return values. Nested values are not processed.\
Currently, the special value types are:

- `Error` objects: Error objects are JSONized as `{ }`, which is perfectly useless. Therefore, objects whose `.constructor.name` ends with `Error` are recreated as instances of the matching class in the target context (or `Error` if the specific class is not present) and their name, message, stack, fileName, lineNumber and columnNumber is set to the original values.
- Functions: a stub function is passed to the handler / as the return value on the other end. All arguments and (asynchronous) return values are passed according to the normal rules described here. Sending the same function over the same Port in either direction multiple times will result in the same stub on the other end, calls to `.addEventListener()`/`.removeEventListener()` should work as expected. The only major drawback is that neither the stub nor the original function can be garbage-collected until the Port is destroyed.

## Adapters

To work with different types of underlying channels, Musliport uses PortAdapters. The PortAdapter class will be passed in the constructor of the Port which instanciates it with the channel and then uses it to send and receive messages.\
A few adapters for common channel types are included, others can be implemented by fulfilling the `PortAdapter` interface below.\
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


This interface needs to be implemented to provide custom adapters for channels which are not directly supported:
```js
class PortAdapter {

	/**
	 * The constructor gets called with three arguments.
	 * @param  {any}       port    The value that was passed as the first argument to the new Port() call
	 *                             where this class was the second argument.
	 *                             Should be the low level port object.
	 * @param  {function}  onData  Function that gets called exactly once for every call to .send()
	 *                             on the other end of the channel.
	 *                             The first three arguments must be JSON clones of the [ name, id, args, ]
	 *                             arguments provided to .send().
	 *                             The 4th argument may be an alternative value for `this` in the handler for
	 *                             this message, which is used if the `thisArg` for the listener is == null.
	 *                             The 5th argument may be a function that is used once instead of .send()
	 *                             to reply to this single message.
	 *                             A trueisch value as 6th argument indicates that handling this message
	 *                             is optional, i.e. it doesn't get rejected if no handler is found.
	 *                             Returns whether the reply function, if provided, will be called asynchronously.
	 * @param  {function}  onEnd   Function that should be called at least once when the underlying port closes.
	 * @return {object}            Any object with .send() and .destroy() methods as specified below.
	 */
	constructor(port, onData = (name, id, args) => { }, onEnd = () => { }) { }

	/**
	 * Needs to serialize and send it's arguments to make them available to the onData() callback
	 * on the other end of the channel.
	 * @param  {string}   name     Arbitrary utf8 string.
	 * @param  {number}   id       A 64-bit float.
	 * @param  {Array}    args     Array of object that should be JSONable.
	 * @param  {object}   options  The options object passed as the first argument to Port.send/post(), or null.
	 * @return {any}               If the .send() function returns a value other than `undefined` it is assumed
	 *                             to be (a Promise to) the messages reply and is returned from port.request().
	 */
	send(name, id, args, options) { }

	/**
	 * Gets called exactly once when the Port object gets .destroy()ed.
	 * Should close the underlying connection if it is still open.
	 * Will be called during or after the onEnd() callback.
	 * The call to .destroy() will be the last access of this object made by the Port instance that created it.
	 */
	destroy() { }
}
```
