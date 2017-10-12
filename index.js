(function(global) { 'use strict'; const factory = function Multiport(exports) { // license: MIT

/**
 * for documentation, see ./README.md or https://github.com/NiklasGollenstede/multiport/blob/master/README.md
 */

// public interface class
const Port = class Port {
	constructor(port, Adapter) { new _Port(this, port, Adapter); }

	addHandler () { methods.addHandler .apply(getPrivate(this), arguments); return this; }
	addHandlers() { methods.addHandlers.apply(getPrivate(this), arguments); return this; }
	removeHandler(name) {        getPrivate(this).removeHandler(name); return this; }
	hasHandler   (name) { return getPrivate(this).hasHandler(name); }

	request   () { return methods.request   .apply(getPrivate(this), arguments); }
	post      () { return methods.post      .apply(getPrivate(this), arguments); }
	afterEnded() { return methods.afterEnded.apply(getPrivate(this), arguments); }

	get ended() { const self = Self.get(this); if (!self) { throw new Error(`Port method used on invalid object`); } return self.ended; }
	isRequest() { return getPrivate(this).isRequest(); }
	releaseCallback(func) { getPrivate(this).releaseCallback(func); return this; }
	destroy() { try { const self = Self.get(this); self && self.destroy(); } catch (error) { reportError(error); } }
};


Port.WebSocket = class WebSocket {

	constructor(port, onData, onEnd) {
		this.port = port;
		this.onMessage = ({ data, }) => { data = JSON.parse(data); onData(data[0], data[1], data[2]); };
		this.onClose = () => onEnd();
		this.port.addEventListener('message', this.onMessage);
		this.port.addEventListener('close', this.onClose);
	}

	send(name, id, args) {
		this.port.send(JSON.stringify([ name, id, args, ]));
	}

	destroy() {
		this.port.removeEventListener('message', this.onMessage);
		this.port.removeEventListener('close', this.onClose);
		this.port.close();
	}
};

Port.MessagePort = class MessagePort {

	constructor(port, onData, _onEnd) {
		this.port = port;
		this.onMessage = ({ data, }) => onData(data[0], data[1], data[2]);
		this.port.addEventListener('message', this.onMessage);
		this.port.start();
	}

	send(name, id, args) {
		this.port.postMessage([ name, id, args, ]);
	}

	destroy() {
		this.port.removeEventListener('message', this.onMessage);
		this.port.close();
	}
};

Port.node_Stream = class node_Stream {

	constructor(port, onData, onEnd) {
		this.port = port;
		this.onData = data => { data = JSON.parse(data.toString('utf8')); onData(data[0], data[1], data[2]); };
		this.onEnd = () => onEnd();
		port.on('data', this.onData);
		port.once('end', this.onEnd);
		port.once('close', this.onEnd);
	}

	send(name, id, args) {
		const data = JSON.stringify([ name, id, args, ]);
		(global.setImmediate || global.setTimeout)(() => this.port.write(data, 'utf8'));
	}

	destroy() {
		this.port.removeListener('data', this.onData);
		this.port.removeListener('end', this.onEnd);
		this.port.removeListener('close', this.onEnd);
		this.port.end();
	}
};

Port.web_ext_Port = class web_ext_Port {

	constructor(port, onData, onEnd) {
		this.port = port;
		this.onMessage = data => onData(data[0], data[1], JSON.parse(data[2]));
		this.onDisconnect = () => onEnd();
		this.port.onMessage.addListener(this.onMessage);
		this.port.onDisconnect.addListener(this.onDisconnect);
	}

	send(name, id, args) {
		args = JSON.stringify(args); // explicitly stringify args to throw any related errors here.
		try {
			this.port.postMessage([ name, id, args, ]); // throws if encoding any of the args throws, or if the port is disconnected:
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
};

// holds references between public interface and private implementation
const Self = new WeakMap/*<Port, _Port>*/;

function getPrivate(other) {
	const self = Self.get(other);
	if (!self) { throw new Error(`Port method used on invalid object`); }
	if (!self.public) { throw new Error(`Can't use disconnected Port`); }
	return self;
}

// private implementation class
class _Port {
	constructor(self, port, Adapter) {
		this.port = new Adapter(port, this.onData.bind(this), this.destroy.bind(this));
		this.requests = new Map; // id ==> PromiseCapability
		this.handlers = new Map; // name ==> [ function, thisArg, ]
		this.wildcards = new Map; // RegExp ==> [ function, thisArg, ]
		this.lastId = 1; // `1` will never be used
		this.cb2id = new WeakMap/*<function, id*/;
		this.id2cb = new Map/*<id, function>*/;
		this.endQueue = [ ];
		this.ended = Object.freeze(new Promise(end => (this.onEnd = end)));
		this._isRequest = 0; // -1: false; 0: throw; 1: true;
		this.public = self;
		Self.set(self, this);
	}
	nextId() { return ++this.lastId; }

	addHandler(name, handler, thisArg) {
		if (typeof name === 'function') { [ handler, thisArg, ] = arguments; name = handler.name; }
		if (typeof handler !== 'function') { throw new TypeError(`Message handlers must be functions`); }
		if (typeof name === 'string' && name !== '') {
			if (this.handlers.has(name)) { throw new Error(`Duplicate message handler for "${ name }"`); }
			this.handlers.set(name, [ handler, thisArg, ]);
		} else {
			const filter = name;
			try { if (typeof filter.test('X') !== 'boolean') { throw null; } } // eslint-disable-line no-throw-literal
			catch (_) { throw new TypeError(`Handler names must be non-empty strings or RegExp wildcards`); }
			this.wildcards.set(filter, [ handler, thisArg, ]);
		}
		return this;
	}
	addHandlers(prefix, handlers, thisArg) {
		if (typeof prefix === 'object') { [ handlers, thisArg, ] = arguments; prefix = ''; }
		if (typeof prefix !== 'string') { throw new TypeError(`Handler name prefixes must be strings (or omitted)`); }
		if (typeof handlers !== 'object') { throw new TypeError(`'handlers' argument must be an object (or Array)`); }

		const add = (
			Array.isArray(handlers)
			? handlers.map(f => [ f && f.name, f, ])
			: Object.keys(handlers).map(k => [ k, handlers[k], ])
		).filter(([ , f, ]) => typeof f === 'function');
		add.forEach(([ name, ]) => {
			if (typeof name !== 'string' || name === '') { throw new TypeError(`Handler names must be non-empty strings`); }
			if (this.handlers.has(name)) { throw new Error(`Duplicate message handler for "${ name }"`); }
		});
		add.forEach(([ name, handler, ]) => this.handlers.set(prefix + name, [ handler, thisArg, ]));
		return this;
	}
	removeHandler(name) {
		typeof name === 'string' ? this.handlers.delete(name) : this.wildcards.delete(name);
		return this;
	}
	hasHandler(name) {
		return typeof name === 'string' ? this.handlers.has(name) : this.wildcards.has(name);
	}
	request(name, ...args) {
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
	post(name, ...args) {
		let options = null;
		if (typeof name === 'object') {
			options = name; name = args.shift();
		}
		if (typeof name !== 'string') { throw new TypeError(`The request name must be a string`); }
		this.port.send(name, 0, args.map(this.mapValue, this), options);
	}
	afterEnded(name, ...args) {
		let options = null;
		if (typeof name === 'object') {
			options = name; name = args.shift();
		}
		if (typeof name !== 'string') { throw new TypeError(`The request name must be a string`); }
		this.port.send('', 0, [ 0, 1, name, args.map(this.mapValue, this), ], options);
	}
	mapValue(value) {
		const isObject = typeof value === 'object' && value !== null;
		if (isObject && ('' in value) && Object.getOwnPropertyDescriptor(value, '')) {
			value = { '': 0, raw: value, };
		} else if (typeof value === 'function') {
			const callback = value, cbId = this.cb2id.get(callback) || getRandomId();
			this.id2cb.set(cbId, callback); this.cb2id.set(callback, cbId);
			value = { '': 1, cb: cbId, };
		} else if (isObject && value.constructor && (/Error$/).test(value.constructor.name)) {
			value = { '': 2,
				name: value.name+'', message: value.message+'', stack: value.stack+'', // ~standard
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
	unmapValue(value) {
		if (typeof value !== 'object' || value === null || !('' in value)) { return value; }
		switch (value['']) {
			case 0: return value.raw;
			case 1: {
				const cbId = value.cb, callback = this.id2cb.get(cbId) || ((...args) => {
					if (!this.public) { throw new Error(`Remote callback connection is closed`); }
					const id = this.nextId();
					const promise = this.port.send('', 0, [ id, 0, cbId, args.map(this.mapValue, this), ], null);
					if (promise !== undefined) { return promise; }
					const request = new PromiseCapability;
					this.requests.set(id, request);
					return request.promise;
				});
				this.id2cb.set(cbId, callback); this.cb2id.set(callback, cbId);
				return callback;
			}
			case 2: {
				delete value['']; const error = new (typeof global[value.name] === 'function' ? global[value.name] : Error);
				return Object.assign(error, value);
			}
			default: throw new TypeError(`Can't unmap argument`);
		}
	}
	isRequest() {
		switch (this._isRequest << 0) {
			case -1: return false;
			case +1: return true;
		}
		throw new Error(`Port.isRequest() may only be called while the port is in a synchronous handler`);
	}
	releaseCallback(cb) {
		const id = this.cb2id.get(cb); if (!id) { return; }
		this.id2cb.delete(id); this.cb2id.delete(cb);
	}
	destroy() {
		if (!this.public) { return; }
		this.endQueue.forEach(([ name, args, ]) => this.onData(name, 0, args));
		this.requests.forEach(_=>_.reject(new Error('The Port this request is waiting on was destroyed')));
		this.requests.clear();
		this.handlers.clear();
		this.id2cb.clear();
		this.onEnd(true); this.ended = true;
		try { this.port.destroy(); } catch (error) { console.error(error); }
		this.public = this.port = null;
	}

	onData(name, id, args, altThis, reply, optional) {
		let value;
		if (name || id === 0) { try { // handle request
			if (!name && id === 0) { // special request
				id = args[0];
				switch (args[1]) {
					case 0: { // callback call
						const callback = this.id2cb.get(args[2]);
						if (!callback) { throw new Error(`Remote callback has been destroyed`); }
						value = callback.apply(null, args[3].map(this.unmapValue, this));
					} break;
					case 1: { // end Queue
						this.endQueue.push([ args[2], args[3], ]);
						return false;
					}
					default: throw new Error(`Bad request`);
				}
			} else {
				args = args.map(this.unmapValue, this);
				let handler, thisArg;
				if (this.handlers.has(name)) {
					[ handler, thisArg, ] = this.handlers.get(name);
				} else {
					for (const [ filter, pair, ] of this.wildcards) {
						if (filter.test(name)) { [ handler, thisArg, ] = pair; break; }
					}
					args.unshift(name);
				}
				if (!handler) { if (!optional) { throw new Error(`No such handler "${ name }"`); } else { return false; } }
				try {
					this._isRequest = id === 0 ? -1 : 1;
					value = handler.apply(thisArg !== undefined ? thisArg : altThis, args);
				} finally { this._isRequest = 0; }
			}
			if (!isPromise(value)) {
				if (id !== 0) { reply ? reply('', +id, [ this.mapValue(value), ]) : this.port.send('', +id, [ this.mapValue(value), ]); }
				return false;
			} else {
				if (id === 0) {
					value.then(null, error => reportError('Uncaught async error in handler (post)', error));
					return false;
				}
				value.then(
					value => reply ? reply('', +id, [ this.mapValue(value), ]) : this.port.send('', +id, [ this.mapValue(value), ]),
					error => reply ? reply('', -id, [ this.mapValue(error), ]) : this.port.send('', -id, [ this.mapValue(error), ])
				);
				return true;
			}
		} catch (error) {
			if (id) {
				reply ? reply('', -id, [ this.mapValue(error), ]) : this.port.send('', -id, [ this.mapValue(error), ]);
			} else {
				reportError('Uncaught error in handler (post)', error);
			}
			return false;
		} } else { try { // resolve reply
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
		} }
	}
}
const methods = _Port.prototype;

const getRandomId = global.crypto
? () => Array.from(global.crypto.getRandomValues(new Uint32Array(3)), _=>_.toString(32)).join('')
: () => [ 0, 0, 0, ].map(() => Math.random().toString(32).slice(2)).join('');

function PromiseCapability() {
	this.promise = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
}

function isPromise(value) { try {
	if (!value || typeof value !== 'object' || typeof value.then !== 'function') { return false; }
	const ctor = value.constructor;
	if (typeof ctor !== 'function') { return false; }
	if (PromiseCtors.has(ctor)) { return PromiseCtors.get(ctor); }
	let is = false; try { new ctor((a, b) => (is = typeof a === 'function' && typeof b === 'function')); } catch (_) { }
	PromiseCtors.set(ctor, is);
	return is;
} catch (_) { return false; } }
const PromiseCtors = new WeakMap;

function reportError() { try { console.error.apply(console, arguments); } catch (_) { } }

return Port;

}; if (typeof define === 'function' && define.amd) { define([ 'exports', ], factory); } else { const exp = { }, result = factory(exp) || exp; if (typeof exports === 'object' && typeof module === 'object') { module.exports = result; } else { global[factory.name] = result; if (typeof QueryInterface === 'function') { global.exports = result; global.EXPORTED_SYMBOLS = [ 'exports', ]; } } } })((function() { return this; })()); // eslint-disable-line
