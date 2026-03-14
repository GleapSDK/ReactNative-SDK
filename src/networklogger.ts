class GleapNetworkIntercepter {
  requestId = 0;
  requests: any = {};
  maxRequests = 30;
  stopped = false;
  initialized = false;
  updatedCallback: any = null;

  setUpdatedCallback(updatedCallback: any) {
    this.updatedCallback = updatedCallback;
  }

  getRequests() {
    return Object.values(this.requests);
  }

  setMaxRequests(maxRequests: number) {
    if (maxRequests > 70) {
      maxRequests = 70;
    }
    this.maxRequests = maxRequests;
  }

  setStopped(stopped: boolean) {
    this.stopped = stopped;
  }

  cleanRequests() {
    var keys = Object.keys(this.requests);
    if (keys.length > this.maxRequests) {
      var keysToRemove = keys.slice(0, keys.length - this.maxRequests);
      for (var i = 0; i < keysToRemove.length; i++) {
        delete this.requests[keysToRemove[i]];
      }
    }

    if (this.updatedCallback) {
      this.updatedCallback();
    }
  }

  calcRequestTime(gleapRequestId: string | number) {
    if (!this.requests[gleapRequestId]) {
      return;
    }

    var req = this.requests[gleapRequestId];
    if (req.startTime) {
      req.duration = Date.now() - req.startTime;
      req.date = new Date(req.startTime).toString();
    }
  }

  isContentTypeSupported(contentType: string | null | undefined): boolean {
    if (typeof contentType !== 'string') {
      return false;
    }

    if (contentType === '') {
      return true;
    }

    contentType = contentType.toLowerCase();
    var supported = ['text/', 'xml', 'json'];
    for (var i = 0; i < supported.length; i++) {
      if (contentType.includes(supported[i])) {
        return true;
      }
    }

    return false;
  }

  getTextContentSizeOk(text: string) {
    if (!text || !text.length) {
      return false;
    }

    try {
      var size = new (global as any).TextEncoder().encode(text).length;
      var megaBytes = size / 1024 / 1024;
      return megaBytes < 0.15;
    } catch (e) {}

    // Fallback: assume ~2 bytes per char (UTF-16)
    var estimatedBytes = text.length * 2;
    var megaBytes = estimatedBytes / 1024 / 1024;
    return megaBytes < 0.15;
  }

  prepareContent(text: string) {
    if (!this.getTextContentSizeOk(text)) {
      return '<content_too_large>';
    }

    return text;
  }

  cleanupPayload(payload: any) {
    if (payload === undefined || payload === null) {
      return '';
    }

    try {
      if (ArrayBuffer.isView(payload)) {
        if (typeof (global as any).TextDecoder !== 'undefined') {
          return new (global as any).TextDecoder().decode(payload);
        }
        return JSON.stringify({ type: 'binary', length: payload.byteLength });
      }
    } catch (exp) {}

    return payload;
  }

  preparePayload(payload: any) {
    var payloadText = this.cleanupPayload(payload);
    return this.prepareContent(payloadText);
  }

  extractFetchUrl(params: any[]): string {
    if (params.length === 0) {
      return '';
    }

    var first = params[0];

    // Handle Request object
    if (first && typeof first === 'object' && typeof first.url === 'string') {
      return first.url;
    }

    // Handle string URL
    if (typeof first === 'string') {
      return first;
    }

    return String(first);
  }

  start() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.setStopped(false);

    this.interceptNetworkRequests({
      onFetch: (params: any[], gleapRequestId: any) => {
        if (this.stopped || params.length === 0) {
          return;
        }

        var url = this.extractFetchUrl(params);
        var first = params[0];

        // Handle Request object: fetch(new Request(url, opts))
        if (
          first &&
          typeof first === 'object' &&
          typeof first.url === 'string'
        ) {
          this.requests[gleapRequestId] = {
            url: first.url,
            startTime: Date.now(),
            date: new Date(),
            request: {
              payload: '',
              headers:
                first.headers && typeof first.headers.entries === 'function'
                  ? Object.fromEntries(first.headers.entries())
                  : {},
            },
            type: first.method || 'GET',
          };
        } else if (params.length >= 2 && params[1] !== undefined) {
          // Handle fetch(url, options)
          var method = params[1].method ? params[1].method : 'GET';
          this.requests[gleapRequestId] = {
            request: {
              payload: this.preparePayload(params[1].body),
              headers: params[1].headers,
            },
            type: method,
            url: url,
            startTime: Date.now(),
            date: new Date(),
          };
        } else {
          // Handle fetch(url)
          this.requests[gleapRequestId] = {
            request: {},
            url: url,
            type: 'GET',
            startTime: Date.now(),
            date: new Date(),
          };
        }

        this.cleanRequests();
      },
      onFetchLoad: (req: any, gleapRequestId: any) => {
        if (
          this.stopped ||
          !gleapRequestId ||
          !this.requests ||
          !this.requests[gleapRequestId]
        ) {
          return;
        }

        try {
          var contentType = '';
          if (req.headers && typeof req.headers.get === 'function') {
            contentType = req.headers.get('content-type') || '';
          }

          if (this.isContentTypeSupported(contentType)) {
            req
              .text()
              .then((responseText: any) => {
                if (this.requests && this.requests[gleapRequestId]) {
                  this.requests[gleapRequestId].success = true;
                  this.requests[gleapRequestId].response = {
                    status: req.status,
                    statusText: req.statusText,
                    responseText: this.prepareContent(responseText),
                  };
                  this.calcRequestTime(gleapRequestId);
                  this.cleanRequests();
                }
              })
              .catch((_err: any) => {
                this.cleanRequests();
              });
          } else {
            this.requests[gleapRequestId].success = true;
            this.requests[gleapRequestId].response = {
              status: req.status,
              statusText: req.statusText,
              responseText: '<content_type_not_supported>',
            };
            this.calcRequestTime(gleapRequestId);
            this.cleanRequests();
          }
        } catch (exp) {
          this.cleanRequests();
        }
      },
      onFetchFailed: (_err: any, gleapRequestId: any) => {
        if (this.stopped || !gleapRequestId) {
          return;
        }

        if (this.requests && this.requests[gleapRequestId]) {
          this.requests[gleapRequestId].success = false;
          this.calcRequestTime(gleapRequestId);
        }
        this.cleanRequests();
      },
      onOpen: (request: any, args: string | any[]) => {
        if (this.stopped) {
          return;
        }

        if (
          request &&
          request.gleapRequestId &&
          args.length >= 2 &&
          this.requests
        ) {
          this.requests[request.gleapRequestId] = {
            type: args[0],
            url: args[1],
            startTime: Date.now(),
            date: new Date(),
          };
        }

        this.cleanRequests();
      },
      onSend: (request: any, args: string | any[]) => {
        if (this.stopped) {
          return;
        }

        if (
          request &&
          request.gleapRequestId &&
          this.requests &&
          this.requests[request.gleapRequestId]
        ) {
          this.requests[request.gleapRequestId].request = {
            payload: this.preparePayload(args.length > 0 ? args[0] : ''),
            headers: request.requestHeaders,
          };
        }

        this.cleanRequests();
      },
      onError: (request: any) => {
        if (
          !this.stopped &&
          this.requests &&
          request &&
          request.gleapRequestId &&
          this.requests[request.gleapRequestId]
        ) {
          this.requests[request.gleapRequestId].success = false;
          this.calcRequestTime(request.gleapRequestId);
        }

        this.cleanRequests();
      },
      onLoad: (request: any) => {
        if (this.stopped) {
          return;
        }

        if (
          request &&
          request.gleapRequestId &&
          this.requests &&
          this.requests[request.gleapRequestId]
        ) {
          var contentType = '';
          try {
            contentType = request.getResponseHeader('content-type') || '';
          } catch (e) {}

          var responseText = '<' + contentType + '>';
          if (this.isContentTypeSupported(contentType)) {
            if (
              request.responseType === '' ||
              request.responseType === 'text'
            ) {
              responseText = request.responseText;
            }
            if (request._response) {
              responseText = request._response;
            }
          }

          this.requests[request.gleapRequestId].success = true;
          this.requests[request.gleapRequestId].response = {
            status: request.status,
            statusText: request.statusText,
            responseText: this.prepareContent(responseText),
          };

          this.calcRequestTime(request.gleapRequestId);
        }

        this.cleanRequests();
      },
    });
  }

  interceptNetworkRequests(callback: any) {
    var self = this;

    // XMLHttpRequest
    const open = XMLHttpRequest.prototype.open;
    const send = XMLHttpRequest.prototype.send;

    // @ts-ignore
    if (XMLHttpRequest.prototype.gleapSetRequestHeader === undefined) {
      // @ts-ignore
      XMLHttpRequest.prototype.gleapSetRequestHeader =
        XMLHttpRequest.prototype.setRequestHeader;
    }

    // @ts-ignore
    if (XMLHttpRequest.prototype.gleapSetRequestHeader) {
      XMLHttpRequest.prototype.setRequestHeader = function (
        header: string,
        value: string
      ) {
        // @ts-ignore
        if (!this.requestHeaders) {
          // @ts-ignore
          this.requestHeaders = {};
        }

        // @ts-ignore
        if (this.requestHeaders && this.requestHeaders.hasOwnProperty(header)) {
          return;
        }

        // @ts-ignore
        if (!this.requestHeaders[header]) {
          // @ts-ignore
          this.requestHeaders[header] = [];
        }

        // @ts-ignore
        this.requestHeaders[header].push(value);
        // @ts-ignore
        this.gleapSetRequestHeader(header, value);
      };
    }

    XMLHttpRequest.prototype.open = function () {
      (this as any).gleapRequestId = ++self.requestId;
      callback.onOpen && callback.onOpen(this, arguments);

      if (callback.onLoad) {
        this.addEventListener('load', function () {
          // @ts-ignore
          callback.onLoad(this);
        });
      }
      if (callback.onError) {
        this.addEventListener('error', function () {
          // @ts-ignore
          callback.onError(this);
        });
      }

      // @ts-ignore
      return open.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      callback.onSend && callback.onSend(this, arguments);
      // @ts-ignore
      return send.apply(this, arguments);
    };

    // Fetch
    if (global && global.fetch) {
      var originalFetch = global.fetch;
      global.fetch = function () {
        var gleapRequestId = ++self.requestId;
        callback.onFetch(arguments, gleapRequestId);

        return (
          originalFetch
            // @ts-ignore
            .apply(this, arguments)
            .then(function (response: any) {
              if (response && typeof response.clone === 'function') {
                var data = response.clone();
                callback.onFetchLoad(data, gleapRequestId);
              }

              return response;
            })
            .catch((err: any) => {
              callback.onFetchFailed(err, gleapRequestId);
              throw err;
            })
        );
      };
    }

    return callback;
  }
}

export default GleapNetworkIntercepter;
