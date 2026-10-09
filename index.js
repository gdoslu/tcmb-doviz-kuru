/*!
 * tcmb-doviz-kuru <https://github.com/gdoslu/tcmb-doviz-kuru.git>
 *
 * Copyright (c) 2016, Gokhan Doslu.
 * Licensed under the MIT License.
 */

'use strict';
var http = require('http');
var https = require('https');
var tls = require('tls');
var url = require('url');
var parseString = require('xml2js').parseString;
var iconv = require('iconv-lite');

// The `request` package was replaced by Node's own http/https. The code below keeps what it did
// implicitly: follow up to 10 redirects and honor HTTP_PROXY/HTTPS_PROXY/NO_PROXY.
var MAX_REDIRECTS = 10;
// Headers `request` also sent to the proxy when tunneling (its default whitelist, as used here)
var TUNNEL_HEADERS = ['accept', 'accept-charset', 'accept-language', 'user-agent', 'referer'];

// getProxyFromURI and helpers: copied from request@2.88.2 lib/getProxyFromURI.js (Apache-2.0)
function formatHostname (hostname) {
    // canonicalize the hostname, so that 'oogle.com' won't match 'google.com'
    return hostname.replace(/^\.*/, '.').toLowerCase();
}

function parseNoProxyZone (zone) {
    zone = zone.trim().toLowerCase();
    var zoneParts = zone.split(':', 2);
    var zoneHost = formatHostname(zoneParts[0]);
    var zonePort = zoneParts[1];
    var hasPort = zone.indexOf(':') > -1;
    return {hostname: zoneHost, port: zonePort, hasPort: hasPort};
}

function uriInNoProxy (uri, noProxy) {
    var port = uri.port || (uri.protocol === 'https:' ? '443' : '80');
    var hostname = formatHostname(uri.hostname);
    var noProxyList = noProxy.split(',');
    return noProxyList.map(parseNoProxyZone).some(function (noProxyZone) {
        var isMatchedAt = hostname.indexOf(noProxyZone.hostname);
        var hostnameMatched = (
            isMatchedAt > -1 &&
            (isMatchedAt === hostname.length - noProxyZone.hostname.length)
        );
        if (noProxyZone.hasPort) {
            return (port === noProxyZone.port) && hostnameMatched;
        }
        return hostnameMatched;
    });
}

function getProxyFromURI (uri) {
    var noProxy = process.env.NO_PROXY || process.env.no_proxy || '';
    if (noProxy === '*') {
        return null;
    }
    if (noProxy !== '' && uriInNoProxy(uri, noProxy)) {
        return null;
    }
    if (uri.protocol === 'http:') {
        return process.env.HTTP_PROXY ||
            process.env.http_proxy || null;
    }
    if (uri.protocol === 'https:') {
        return process.env.HTTPS_PROXY ||
            process.env.https_proxy ||
            process.env.HTTP_PROXY ||
            process.env.http_proxy || null;
    }
    return null;
}

function defaultPort(uri) {
    return uri.port || (uri.protocol === 'https:' ? 443 : 80);
}

function basicAuth(auth) {
    return 'Basic ' + Buffer.from(auth).toString('base64');
}

/**
 * Opens a CONNECT tunnel through an HTTP(S) proxy to target, like request's tunnel-agent did
 */
function tunnel(proxy, target, headers, cb) {
    var connectHeaders = {host: target.hostname + ':' + defaultPort(target)};
    Object.keys(headers).forEach(function (name) {
        if (TUNNEL_HEADERS.indexOf(name.toLowerCase()) > -1) connectHeaders[name] = headers[name];
    });
    if (proxy.auth) connectHeaders['Proxy-Authorization'] = basicAuth(proxy.auth);
    var req = (proxy.protocol === 'https:' ? https : http).request({
        hostname: proxy.hostname,
        port: defaultPort(proxy),
        method: 'CONNECT',
        path: connectHeaders.host,
        headers: connectHeaders,
        agent: false
    });
    req.on('connect', function (res, socket) {
        if (res.statusCode !== 200) {
            socket.destroy();
            return cb(new Error('tunneling socket could not be established, statusCode=' + res.statusCode));
        }
        cb(null, tls.connect({socket: socket, host: target.hostname, servername: target.hostname}));
    });
    req.on('error', function (err) {
        cb(new Error('tunneling socket could not be established, cause=' + err.message));
    });
    req.end();
    return req;
}

/**
 * GETs link and calls back with (error, response, bodyBuffer), following redirects
 */
function get(link, headers, redirects, cb) {
    var target = url.parse(link);
    // Same checks, order and messages as request
    if (!target.hostname) {
        return process.nextTick(cb, new Error('Invalid URI "' + link + '"'));
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
        return process.nextTick(cb, new Error('Invalid protocol: ' + target.protocol));
    }
    var proxyURL = getProxyFromURI(target);
    var proxy = proxyURL && url.parse(proxyURL);
    var isHttps = target.protocol === 'https:';
    var options = {
        hostname: target.hostname,
        port: defaultPort(target),
        path: target.path,
        headers: Object.assign({host: target.host}, headers)
    };
    var lib = isHttps ? https : http;

    function onResponse(res) {
        var location = res.headers.location;
        if (res.statusCode >= 300 && res.statusCode < 400 && location) {
            res.resume();
            if (redirects >= MAX_REDIRECTS) {
                return cb(new Error('Exceeded maxRedirects. Probably stuck in a redirect loop ' + target.href));
            }
            var next = url.resolve(target.href, location);
            return get(next, Object.assign({}, headers, {referer: target.href}), redirects + 1, cb);
        }
        var chunks = [];
        res.on('data', function (chunk) { chunks.push(chunk); });
        res.on('end', function () { cb(null, res, Buffer.concat(chunks)); });
        res.on('error', cb);
    }

    function send(createConnection) {
        if (createConnection) options.createConnection = createConnection;
        var req = lib.request(options, onResponse);
        req.on('error', cb);
        req.end();
        return req;
    }

    if (proxy && isHttps) {
        return tunnel(proxy, target, headers, function (err, socket) {
            if (err) return cb(err);
            send(function () { return socket; });
        });
    }
    if (proxy) {
        // Plain http through a proxy: ask the proxy for the absolute URL
        lib = proxy.protocol === 'https:' ? https : http;
        options.hostname = proxy.hostname;
        options.port = defaultPort(proxy);
        options.path = target.href;
        if (proxy.auth) options.headers['proxy-authorization'] = basicAuth(proxy.auth);
    }
    return send();
}

/**
 * Calls cb only once, whatever fails afterwards
 */
function once(cb) {
    var called = false;
    return function () {
        if (called) return;
        called = true;
        cb.apply(null, arguments);
    };
}


/**
 * Converts first letter of the given parameter to lowercase
 * @param string
 * @returns {string}
 */
function lowerCaseFirstLetter(string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
}

/**
 * Converts first letter of the given parameter to lowercase, then removes '_' and converts it to camel case
 * @param name
 * @returns {XML|string|void|*}
 */
function prettyName(name){
    return lowerCaseFirstLetter(name).replace(/[-_]+(.)?/g, function (g) { return g[1].toUpperCase(); });
}

/**
 * Checks value is parsable to float and return float if
 * @param val
 * @returns {*}
 */
function valueProcessors(val) {
    if (val) {
        var floatVal = parseFloat(val);
        if(isNaN(floatVal)) return val;
        return floatVal;
    }
}

module.exports = function(cb, dataSourceURL = 'https://www.tcmb.gov.tr/kurlar/today.xml', encoding = 'UTF-8') { // XML Source for Indicative Exchange Rates Announced by the Central Bank of Turkey

    var options = {
        url: dataSourceURL,
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.95 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.8,tr;q=0.6',
            'Accept-Charset': encoding
    },

    };
    return get(options.url, options.headers, 0, once((error, response, body) => {
        if (error) {
            return cb(error, null);
        }
        if (response.statusCode != 200) {
            return cb('Response code is: ' + response.statusCode, null);
        }

        var xml = iconv.decode(body, encoding);

        if (!xml || xml.search('Tarih_Date') === -1) {
            return cb('Invalid xml', null);
        }
        // converts xml to json
        parseString(xml, {
                attrkey: 'attributes',
                tagNameProcessors: [prettyName],
                attrNameProcessors: [prettyName],
                valueProcessors: [valueProcessors],
                trim: true,
                explicitArray: false,
                emptyTag: null
            },
            function (err, result) {
                cb(err, result);
            });
    }));
};