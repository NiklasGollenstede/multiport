
/**
 * for documentation, see ./README.md or https://github.com/NiklasGollenstede/multiport/blob/master/README.md
 */

/// @ts-check

/**
 * @typedef {() => Promise<any>|any} Handler - Message handler function.
 */

/**
 * @typedef {[ name: string, id: number, args: any[], ]} RawMessage - Message in the format passed to the `PortAdapter`s.
 */

/**
 * @template NativePortT
 */
export class Port {

	/**
	 * Takes one end of a communication channel and prepares it to send and receive requests.

	 * @param  {NativePortT}  port  The low-level port object that is connected to the communication channel.
	 *                              Its only use is as the argument to `Adapter`.
	 * @param  {{ new(port: NativePortT, onData: (..._: RawMessage) => boolean, onEnd: () => void): PortAdapter<NativePortT>, }}   Adapter
	 *                              A simple adapter class to provide a common interface for different types
	 *                              of low level ports. This can ether be one of (for details see below)
	 *                                  Port.WebSocket        for  browser WebSockets,
	 *                                  Port.MessagePort      for  browser MessagePorts,
	 *                                  Port.node_Stream      for  node.js DuplexSteams,
	 *                                  Port.web_ext_Port     for  (browser/chrome).runtime.Port object in
	 *                                                             Chromium, Firefox and Opera extensions,
	 *                              or any other class that implements the PortAdapter interface.
	 */
	constructor(port, Adapter) { new _Port(this, port, Adapter); }

	/**
	 * Adds a named message handler.
	 * @param  {string|RegExp}  name  Optional. Non-empty name of this handler, which can be used
	 *                              by .request() and .post() to call this handler.
	 *                              Defaults to `handler`.name.
	 *                              Alternatively to an explicit name, a RegExp can be passed as name wildcard:
	 *                              Messages with names that are not handled by a handler with a string
	 *                              name are handled by this handler if their name matches the expression.
	 *                              The first argument to the handler will be the actual name.
	 * @param  {Handler}  handler  The handler function. It will be called with JSON-clones
	 *                              of all additional arguments provided to .request() or .post()
	 *                              and may return a Promise to asynchronously return a value.
	 * @param  {any}       thisArg  `this` to pass to the handler when called.
	 *                              If == null, it may be set by the PortAdapter.
	 * @return {this}               Self reference for chaining.
	 * @throws {Error}              If a handler for `name` is already registered.
	 */
	addHandler(name, handler, thisArg) { methods.addHandler.call(getPrivate(this), name, handler, thisArg); return this; }

	/**
	 * Adds multiple named message handlers.
	 * @param  {string}  prefix    Optional prefix to prepend to all handler names specified in `handlers`.
	 * @param  {Record<string, Handler>}  handlers  Ether an array of named functions or an object with methods.
	 *                             Array entries / object properties that are not functions are ignored.
	 * @param  {any}     thisArg   `this` to pass to the handler when called.
	 *                             If == null, it may be set by the PortAdapter.
	 * @return {this}              Self reference for chaining.
	 * @throws {Error}             If there is already a handler registered for any `prefix`
	 *                             + handler.name; no handlers have been added.
	 */
	addHandlers(prefix, handlers, thisArg) { methods.addHandlers.call(getPrivate(this), prefix, handlers, thisArg); return this; }

	/**
	 * Removes a named handler.
	 * @param  {string|RegExp}   name  The name of the handler to be removed.
	 * @return {this}        Self reference for chaining.
	 */
	removeHandler(name) { getPrivate(this).removeHandler(name); return this; }

	/**
	 * Queries the existence of a named handler.
	 * @param  {string|RegExp}  name  The name of the handler to query.
	 * @return {boolean}              `true` iff a handler is listening on this port.
	 */
	hasHandler(name) { return getPrivate(this).hasHandler(name); }

	/**
	 * Calls a handler on the other end of this port and returns a Promise to its return value.
	 * @param  {object}  options  Optional, may be omitted.
	 *                            If specified, it will be passed as 4th argument to PortAdapter.send().
	 * @param  {string}  name     Name of the remote handler to call.
	 * @param  {...any}  args     Additional arguments whose JSON-clones are passed to the remote handler.
	 * @return {Promise<any>}     Promise that rejects if the request wasn't handled or if the handler
	 *                            threw and otherwise resolves to the handlers return value.
	 */
	request(options, name, args) { return methods.request.call(getPrivate(this), options, name, args); }


	/**
	 * Calls a handler on the other end of this port without waiting for its return value
	 * and without guarantee that a handler has in fact been called.
	 * @param  {object}  options  Optional, may be omitted.
	 *                            If specified, it will be passed as 4th argument to PortAdapter.send().
	 * @param  {string}  name     Name of the remote handler to call.
	 * @param  {...any}  args     Additional arguments whose JSON-clones are passed to the remote handler.
	 */
	post(options, name, args) { methods.post.call(getPrivate(this), options, name, args); }

	/**
	 * Experimental. Calls a handler on the other end with the specified arguments
	 * after the underlying connection was closed, right before `.ended` resolves.
	 * Has the same arguments and semantics as `.post()`. Can for example be used to release resources.
	 * @param  {object}  options  Optional, may be omitted.
	 *                            If specified, it will be passed as 4th argument to PortAdapter.send().
	 * @param  {string}  name     Name of the remote handler to call.
	 * @param  {...any}  args     Additional arguments whose JSON-clones are passed to the remote handler.
	 */
	afterEnded(options, name, args) { methods.afterEnded.call(getPrivate(this), options, name, args); }

	/**
	 * While the port is open, returns a frozen Promise that resolves
	 * with an optional reason when the Port gets `.destroy()`ed.
	 * After the port is closed, it returns `true`.
	 */
	get ended() { const self = Self.get(this); if (!self) { throw new Error(`Port method used on invalid object`); } return self.ended; }

	/**
	 * Tells whether the currently synchronously handled message is a request or post.
	 * Can be useful when forwarding requests.
	 * @return {boolean}  If false, the current handler is called by a remote `.post()`,
	 *                    i.e. the return value of the handler is not used.
	 * @throws {Error}    If this Port is not currently in a synchronous call to a handler.
	 */
	isRequest() { return getPrivate(this).isRequest(); }

	/**
	 * Experimental. Takes a function that has been previously passed trough this port,
	 * or a remote stub returned by it, and releases both the function and its stub,
	 * so that they can be garbage collected.
	 * Calling the stub will throw, sending that function again will result in new stubs.
	 * @param  {function?}  callback  S.o. if it is a function/stub, no-op otherwise.
	 * @return {this}       Self reference for chaining.
	 */
	releaseCallback(callback) { getPrivate(this).releaseCallback(callback, false); return this; }

	/**
	 * Destroys the Port instance and the underlying PortAdapter.
	 * Gets automatically called when the underlying port closes.
	 * After the instance is destroyed, all other methods on this instance will throw.
	 * Never throws and any further calls to `.destroy()` will be ignored.
	 * @param  {Error?}  reason  Optional disconnect reason (object or null).
	 */
	destroy(reason) { try { const self = Self.get(this); self && self.destroy(reason); } catch (error) { reportError(error); } }
} export default Port;

/**
 * Interface of the adapter that uniforms different communication channel endpoints to work as backends for a `Port`.
 * This interface needs to be implemented to provide custom adapters for channels which are not directly supported.
 * @abstract
 * @template NativePortT
 */
export class PortAdapter {

    /**
     * The constructor gets called with three arguments.
     * @param  {NativePortT}  port  The value that was passed as the first argument to the new Port() call
     *                              where this class was the second argument.
     *                              Should be the low level port object.
     * @param  {(..._: RawMessage) => boolean}  onData  Function that gets called exactly once for every
     *                              call to .send() on the other end of the channel.
     *                              The first three arguments must be JSON clones of the
     *                              [ name, id, args, ] arguments provided to `.send()`.
     *                              The 4th argument may be a fallback value for `this` in the handler,
     *                              which is used if the `thisArg` for the listener is == null.
     *                              The 5th argument may be a function that is used once instead of `.send()`
     *                              to reply to this single message.
     *                              A trueisch value as 6th argument indicates that handling this message
     *                              is optional, i.e. it doesn't get rejected if no handler is found.
     *                              Returns whether the reply function, will be called asynchronously.
     * @param  {() => void}  onEnd  Must be called at least once when the underlying port closes.
     */
    constructor(port, onData, onEnd) { void onEnd; }

    /**
     * Needs to serialize and send it's arguments to make them available to the onData() callback
     * on the other end of the channel.
     * @param  {string}   name     Arbitrary utf8 string.
     * @param  {number}   id       A 64-bit float.
     * @param  {any[]}    args     Array of object that should be JSONable.
     * @param  {object?}  options  The options object passed as the first argument to Port.send/post().
     * @return {Promise<any>|void}  If the `.send()` function returns a value other than `undefined` it is
     *                             assumed to be (a Promise to) the messages reply and is returned from
     *                             `port.request()`.
     */
    send(name, id, args, options) { void options; }

    /**
     * Gets called exactly once when the Port object gets .destroy()ed.
     * Should close the underlying connection if it is still open.
     * Will be called during or after the onEnd() callback.
     * The call to .destroy() will be the last access of this object made by the Port instance
     * that created it.
     */
    destroy() { }
}

/** `PortAdapter` for (browser and node-ws) `WebSocket`s. */
export class WebSocket extends PortAdapter {

	constructor(port, onData, onEnd) { super(port, onData, onEnd);
		this.port = port;
		this.onMessage = ({ data, }) => { data = JSON.parse(data); onData(data[0], data[1], data[2]); };
		this.onClose = onEnd; // with CloseEvent
		this.port.addEventListener('message', this.onMessage);
		this.port.addEventListener('close', this.onClose);
	}

	send(name, id, args) {
		this.port.send(JSON.stringify([name, id, args,]));
	}

	destroy() {
		this.port.removeEventListener('message', this.onMessage);
		this.port.removeEventListener('close', this.onClose);
		this.port.close();
	}
} Port.WebSocket = WebSocket;

/** `PortAdapter` for browser inter-`window` `MessagePort`s. */
export class MessagePort extends PortAdapter {

	constructor(port, onData, onEnd) { super(port, onData, onEnd);
		this.port = port;
		this.onMessage = ({ data, }) => onData(data[0], data[1], data[2]);
		this.port.addEventListener('message', this.onMessage);
		this.port.start();
		// there is no close/end/... event
	}

	send(name, id, args) {
		this.port.postMessage([name, id, args,]);
	}

	destroy() {
		this.port.removeEventListener('message', this.onMessage);
		this.port.close();
	}
} Port.MessagePort = MessagePort;

/** `PortAdapter` for browser node.js native `Stream`s. */
class node_Stream extends PortAdapter {

	constructor(port, onData, onEnd) { super(port, onData, onEnd);
		this.port = port;
		this.onData = data => { data = JSON.parse(data.toString('utf8')); onData(data[0], data[1], data[2]); };
		this.onEnd = onEnd;
		port.on('data', this.onData);
		port.once('error', this.onEnd);
		port.once('finish', this.onEnd);
		port.once('close', this.onEnd);
		port.once('end', this.onEnd);
	}

	send(name, id, args) {
		const data = JSON.stringify([name, id, args,]);
		(globalThis.setImmediate || globalThis.setTimeout)(() => this.port.write(data, 'utf8'));
	}

	destroy() {
		this.port.removeListener('data', this.onData);
		this.port.removeListener('error', this.onEnd);
		this.port.removeListener('finish', this.onEnd);
		this.port.removeListener('close', this.onEnd);
		this.port.removeListener('end', this.onEnd);
		this.port.end();
	}
} Port.node_Stream = node_Stream;

/** `PortAdapter` for browser WebExtension `Port` objects. */
class web_ext_Port extends PortAdapter {

	constructor(port, onData, onEnd) { super(port, onData, onEnd);
		this.port = port;
		this.onMessage = data => onData(data[0], data[1], JSON.parse(data[2]));
		this.onDisconnect = () => onEnd(port.error || null); // Port#error must be polyfilled for non-gecko
		this.port.onMessage.addListener(this.onMessage);
		this.port.onDisconnect.addListener(this.onDisconnect);
	}

	send(name, id, args) {
		args = JSON.stringify(args); // explicitly stringify args to throw any related errors here.
		try {
			this.port.postMessage([name, id, args,]); // throws if encoding any of the args throws, or if the port is disconnected:
		} catch (error) { // firefox tends to not fire the onDisconnect event
			// the port was unable to send an array of primitives ==> it is actually closed
			// TODO: can it throw for other reasons (message to long, ...)?
			console.error('Error in postMessage, closing Port:', error);
			this.onDisconnect();
		}
	}

	destroy() {
		this.port.onMessage.removeListener(this.onMessage);
		this.port.onDisconnect.removeListener(this.onDisconnect);
		this.port.disconnect();
	}
} Port.web_ext_Port = web_ext_Port;

// holds references between public interface and private implementation
const Self = /**@type{WeakMap<Port, _Port>}*/(new WeakMap);

function getPrivate(other) {
	const self = Self.get(other);
	if (!self) { throw new Error(`Port method used on invalid object`); }
	if (!self.public) { throw new Error(`Can't use disconnected Port`); }
	return self;
}


/// implementation

class _Port {

	constructor(/**@type{Port}*/self, /**@type{any}*/port, /**@type{{ new(port: any, onData, onEnd): PortAdapter<any>, }}*/Adapter) {
		this.port = new Adapter(port, this.onData.bind(this), this.destroy.bind(this));
		this.requests = /**@type{Map<number, PromiseCapability>}*/(new Map);
		this.handlers = /**@type{Map<string, [ function, any, ]>}*/(new Map);
		this.wildcards = /**@type{Map<RegExp, [ function, any, ]>}*/(new Map);
		this.lastId = 1; // `1` will never be used
		this.cb2id = /**@type{WeakMap<function, string>}*/(new WeakMap);
		this.id2cb = /**@type{Map<string, function>}*/(new Map);
		this.endQueue = [];
		this.ended = /**@type{Promise<Error|void>|true}*/(Object.freeze(new Promise(end => (this.onEnd = end))));
		this._isRequest = 0; // -1: false; 0: throw; 1: true;
		this.public = self;
		Self.set(self, this);
	}
	nextId() { return ++this.lastId; }

	addHandler(/**@type{string|RegExp}*/name, /**@type{Handler}*/handler, /**@type{any}*/thisArg) {
		if (typeof name === 'function') { [handler, thisArg,] = arguments; name = handler.name; }
		if (typeof handler !== 'function') { throw new TypeError(`Message handlers must be functions`); }
		if (typeof name === 'string' && name !== '') {
			if (this.handlers.has(name)) { throw new Error(`Duplicate message handler for "${name}"`); }
			this.handlers.set(name, [handler, thisArg,]);
		} else {
			const filter = name;
			try { if (typeof /**@type{RegExp}*/(filter).test('X') !== 'boolean') { throw null; } } // eslint-disable-line no-throw-literal
			catch (_) { throw new TypeError(`Handler names must be non-empty strings or RegExp wildcards`); }
			this.wildcards.set(/**@type{RegExp}*/(filter), [ handler, thisArg, ]);
		}
		return this;
	}
	addHandlers(/**@type{string}*/prefix, /**@type{Record<String, Handler>}*/handlers, /**@type{any}*/thisArg) {
		if (typeof prefix === 'object') { [handlers, thisArg,] = arguments; prefix = ''; }
		if (typeof prefix !== 'string') { throw new TypeError(`Handler name prefixes must be strings (or omitted)`); }
		if (typeof handlers !== 'object') { throw new TypeError(`'handlers' argument must be an object (or Array)`); }

		const add = (
			Array.isArray(handlers)
				? handlers.map(f => [f && f.name, f,])
				: Object.keys(handlers).map(k => [k, handlers[k],])
		).filter(([, f,]) => typeof f === 'function');
		add.forEach(([name,]) => {
			if (typeof name !== 'string' || name === '') { throw new TypeError(`Handler names must be non-empty strings`); }
			if (this.handlers.has(name)) { throw new Error(`Duplicate message handler for "${name}"`); }
		});
		add.forEach(([name, handler,]) => this.handlers.set(prefix + name, [handler, thisArg,]));
		return this;
	}
	removeHandler(/**@type{string|RegExp}*/name) {
		typeof name === 'string' ? this.handlers.delete(name) : this.wildcards.delete(name);
		return this;
	}
	hasHandler(/**@type{string|RegExp}*/name) {
		return typeof name === 'string' ? this.handlers.has(name) : this.wildcards.has(name);
	}
	request(/**@type{string}*/name, /**@type{any[]}*/...args) {
		let options = null;
		if (typeof name === 'object') {
			options = name; name = args.shift();
		}
		if (typeof name !== 'string') { throw new TypeError(`The request name must be a string`); }
		const id = this.nextId();
		const value = this.port.send(name, id, args.map(this.mapValue, this), options);
		if (value !== undefined) { return value; }
		const request = new PromiseCapability;
		this.requests.set(id, request);
		return request.promise;
	}
	post(/**@type{string}*/name, /**@type{any[]}*/...args) {
		let options = null;
		if (typeof name === 'object') {
			options = name; name = args.shift();
		}
		if (typeof name !== 'string') { throw new TypeError(`The request name must be a string`); }
		this.port.send(name, 0, args.map(this.mapValue, this), options);
	}
	afterEnded(/**@type{string}*/name, ...args) {
		let options = null;
		if (typeof name === 'object') {
			options = name; name = args.shift();
		}
		if (typeof name !== 'string') { throw new TypeError(`The request name must be a string`); }
		this.port.send('', 0, [0, 1, name, args.map(this.mapValue, this),], options);
	}
	mapValue(/**@type{any}*/value) {
		const isObject = typeof value === 'object' && value !== null;
		if (isObject && ('' in value) && Object.getOwnPropertyDescriptor(value, '')) {
			value = { '': 0, raw: value, };
		} else if (typeof value === 'function') {
			const callback = value, cbId = this.cb2id.get(callback) || getRandomId();
			this.id2cb.set(cbId, callback); this.cb2id.set(callback, cbId);
			value = { '': 1, cb: cbId, };
		} else if (isObject && value.constructor && (/Error$/).test(value.constructor.name)) {
			value = {
				'': 2,
				name: value.name + '', message: value.message + '', stack: value.stack + '', // ~standard
				code: typeof value.code === 'number' || typeof value.code === 'string' ? value.code : undefined, // node.js
				status: typeof value.status === 'number' || typeof value.status === 'string' ? value.status : undefined, // http server
				expose: typeof value.expose === 'boolean' ? value.expose : undefined, // http server
				fileName: typeof value.fileName === 'string' ? value.fileName : undefined, // gecko
				lineNumber: typeof value.lineNumber === 'number' ? value.lineNumber : undefined, // gecko
				columnNumber: typeof value.columnNumber === 'number' ? value.columnNumber : undefined, // gecko
			};
		}
		return value;
	}
	unmapValue(/**@type{any}*/value) {
		if (typeof value !== 'object' || value === null || !('' in value)) { return value; }
		switch (value['']) {
			case 0: return value.raw;
			case 1: {
				const cbId = value.cb, callback = this.id2cb.get(cbId) || ((...args) => {
					if (!this.public) { throw new Error(`Remote callback connection is closed`); }
					const id = this.nextId();
					const promise = this.port.send('', 0, [id, 0, cbId, args.map(this.mapValue, this),], null);
					if (promise !== undefined) { return promise; }
					const request = new PromiseCapability;
					this.requests.set(id, request);
					return request.promise;
				});
				this.id2cb.set(cbId, callback); this.cb2id.set(callback, cbId);
				return callback;
			}
			case 2: {
				delete value['']; const error = new (typeof globalThis[value.name] === 'function' ? globalThis[value.name] : Error);
				return Object.assign(error, value);
			}
			default: throw new TypeError(`Can't unmap argument`);
		}
	}
	isRequest() {
		switch (this._isRequest) {
			case -1: return false;
			case +1: return true;
		}
		throw new Error(`Port.isRequest() may only be called while the port is in a synchronous handler`);
	}
	releaseCallback(/**@type{function}*/callback, /**@type{boolean}*/remote) {
		const cbId = this.cb2id.get(callback); if (!cbId) { return; }
		this.id2cb.delete(cbId); this.cb2id.delete(callback);
		!remote && this.port.send('', 0, [0, 2, cbId,], null);
	}
	destroy(/**@type{Error?}*/error) {
		if (!this.public) { return; }
		this.endQueue.forEach(([name, args,]) => this.onData(name, 0, args));
		this.requests.forEach(_ => _.reject(new Error('The Port this request is waiting on was destroyed')));
		this.requests.clear(); this.handlers.clear(); this.id2cb.clear();
		this.onEnd(typeof error === 'object' ? Object.freeze(error) : null); this.ended = true;
		try { this.port.destroy(); } catch (error) { console.error(error); }
		this.public = this.port = null;
	}

	onData(/**@type{string}*/name, /**@type{number}*/id, /**@type{any[]}*/args, /**@type{any}*/altThis, /**@type{(name: '', id: number, data: [ any, ]) => void}*/reply, /**@type{boolean}*/optional) {
		let value;
		if (name || id === 0) {
			try { // handle request
				if (!name && id === 0) { // special request
					id = args[0];
					switch (args[1]) {
						case 0: { // callback call
							const callback = this.id2cb.get(args[2]);
							if (!callback) { throw new Error(`Remote callback has been destroyed`); }
							value = callback.apply(null, args[3].map(this.unmapValue, this));
						} break;
						case 1: { // end Queue
							this.endQueue.push([args[2], args[3],]);
							return false;
						}
						case 2: { // callback release
							this.endQueue.push([args[2], args[3],]);
							return false;
						}
						default: throw new Error(`Bad request`);
					}
				} else {
					args = args.map(this.unmapValue, this);
					let handler, thisArg;
					if (this.handlers.has(name)) {
						[handler, thisArg,] = this.handlers.get(name);
					} else {
						for (const [filter, pair,] of this.wildcards) {
							if (filter.test(name)) { [handler, thisArg,] = pair; break; }
						}
						args.unshift(name);
					}
					if (!handler) { if (!optional) { throw new Error(`No such handler "${name}"`); } else { return false; } }
					try {
						this._isRequest = id === 0 ? -1 : 1;
						value = handler.apply(thisArg !== undefined ? thisArg : altThis, args);
					} finally { this._isRequest = 0; }
				}
				if (!isPromise(value)) {
					if (id !== 0) { reply ? reply('', +id, [this.mapValue(value),]) : this.port.send('', +id, [this.mapValue(value),]); }
					return false;
				} else {
					if (id === 0) {
						value.then(null, error => reportError('Uncaught async error in handler (post)', error));
						return false;
					}
					value.then(
						value => reply ? reply('', +id, [this.mapValue(value),]) : this.port.send('', +id, [this.mapValue(value),]),
						error => reply ? reply('', -id, [this.mapValue(error),]) : this.port.send('', -id, [this.mapValue(error),])
					);
					return true;
				}
			} catch (error) {
				if (id) {
					reply ? reply('', -id, [this.mapValue(error),]) : this.port.send('', -id, [this.mapValue(error),]);
				} else {
					reportError('Uncaught error in handler (post)', error);
				}
				return false;
			}
		} else {
			try { // resolve reply
				const threw = id < 0; threw && (id = -id);
				const request = this.requests.get(id); this.requests.delete(id);
				if (!request) { throw new Error(`Bad or duplicate response id`); }
				if (threw) {
					request.reject(this.unmapValue(args[0]));
				} else {
					request.resolve(this.unmapValue(args[0]));
				}
				return false;
			} catch (error) {
				reportError(error);
				return false;
			}
		}
	}

} const methods = _Port.prototype;

const getRandomId = globalThis.crypto
	? () => Array.from(globalThis.crypto.getRandomValues(new Uint32Array(3)), _ => _.toString(32)).join('')
	: () => [0, 0, 0,].map(() => Math.random().toString(32).slice(2)).join('');

function PromiseCapability() {
	this.promise = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
}

function isPromise(/**@type{unknown}*/value) {
	try {
		if (!value || typeof value !== 'object' || typeof /**@type{any}*/(value).then !== 'function') { return false; }
		const ctor = value.constructor; if (typeof ctor !== 'function') { return false; }
		if (PromiseCtors.has(ctor)) { return PromiseCtors.get(ctor); }
		let is = false; try { new /**@type{any}*/(ctor)((a, b) => (is = typeof a === 'function' && typeof b === 'function')); } catch (_) { }
		PromiseCtors.set(ctor, is);
		return is;
	} catch (_) { return false; }
}
const PromiseCtors = /**@type{WeakMap<function, boolean>}*/(new WeakMap);

function reportError() { try { console.error.apply(console, arguments); } catch (_) { } }
