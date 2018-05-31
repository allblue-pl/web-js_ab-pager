'use strict';

const
    js0 = require('js0')
;

class Pager
{

    constructor()
    {
        this._initialized = false;

        this._base = '/';
        this._pages = new Map();

        this._currentPage = null;

        this._listeners_OnPageChanged = [];
    }

    base(uriBase)
    {
        this._base = uriBase;

        return this;
    }

    getPageUri(uri, args = {}, parsedArgs = null, pathOnly = false)
    {
        var uriArgs = uri === '' ? [] : uri.split('/');
        if (uriArgs[uriArgs.length - 1] === '')
            uriArgs.pop();

        var pUri = '';
        for (var i = 0; i < uriArgs.length; i++) {
            if (uriArgs[i][0] !== ':') {
                pUri += uriArgs[i] + '/';
                continue;
            }

            var argInfo = this._getUriArgInfo(uriArgs[i]);

            if (!(argInfo.name in args)) {
                pUri += argInfo.defaultValue + '/';

                if (parsedArgs !== null)
                    parsedArgs[argInfo.name] = null;

                continue;
            }

            pUri += args[argInfo.name] + '/';

            if (parsedArgs !== null)
                parsedArgs[argInfo.name] = String(args[argInfo.name]);
        }

        if (pathOnly)
            return pUri;
        else
            return this._base + pUri;
    }

    init()
    {
        this._initialized = true;

        window.onpopstate = () => {
            this._parseUri(window.location.pathname + window.location.search);
        };
        this._parseUri(window.location.pathname + window.location.search);
    }

    page(name, uri, onPageSetListener)
    {
        js0.args(arguments, 'string', 'string', 'function');

        this._pages.set(name, new Pager.Page(name, uri));

        if (onPageSetListener !== null) {
            this._listeners_OnPageChanged.push((page, sourcePageName) => {
                if (page.name === name)
                    onPageSetListener(sourcePageName);
            });
        }

        return this;
    }

    setPage(pageName, args = {}, pushState = true)
    {
        js0.args(arguments, 'string', [ js0.Default, 'object' ], [ js0.Default, 'boolean' ]);

        if (!this._pages.has(pageName))
            throw new Error('Page `' + pageName + '` does not exist.`');

        let source = this._currentPage;
        this._currentPage = this._pages.get(pageName);
        this._currentPageInfo = {
            name: pageName,
            args: {}
        };

        let uri = this.getPageUri(this._currentPage.uri, args,
                this._currentPageInfo.args);

        if (pushState)
            window.history.pushState({}, this._currentPage.title, uri);
        else
            window.history.replaceState({}, this._currentPage.title, uri);

        for (let i = 0; i < this._listeners_OnPageChanged.length; i++)
            this._listeners_OnPageChanged[i](this._currentPage, source);
    }

    setUri(uri, pushState)
    {
        pushState = typeof pushState === 'undefined' ? true : pushState;
        this._parseUri(uri, pushState);
    }


    _getUriArgInfo(uriArg)
    {
        var argName = uriArg.substring(1);
        var argDefault = uriArg;
        var argNameArray = argName.split('#');
        if (argNameArray.length > 1) {
            argName = argNameArray[0];
            argDefault = argNameArray[1];
        }

        return {
            name: argName,
            defaultValue: argDefault
        };
    }

    _parseUri(uri, pushState)
    {
        pushState = typeof pushState === 'undefined' ? false : pushState;

        if (this._pages.size === 0)
            throw new Error('Cannot parse uri. No pages set.');

        let base = this._base;
        base = base.substring(0, base.length);

        if (uri.indexOf(base) !== 0) {
            window.location = base;
            return;
        }

        uri = uri.substring(base.length);

        let uriArray = uri.split('/');
        if (uriArray[uriArray.length - 1] === '')
            uriArray.pop();
        
        if (uriArray.length === 0)
            uriArray.push('');

        for (let [ pageName, page ] of this._pages) {
            let aliasArray = page.uri.split('/');

            if (aliasArray.length != uriArray.length)
                continue;

            let args = {};
            let uriMatched = true;
            for (let i = 0; i < aliasArray.length; i++) {
                if (aliasArray[i] === '') {
                    uriMatched = uriArray[i] === '';
                    break;
                }

                if (aliasArray[i][0] === ':') {
                    if (aliasArray[i][0] === 1) {
                        uriMatched = false;
                        break;
                    }

                    let uriArgInfo = this._getUriArgInfo(aliasArray[i]);

                    args[uriArgInfo.name] = uriArray[i];
                    continue;
                }

                if (aliasArray[i] !== uriArray[i]) {
                    uriMatched = false;
                    break;
                }
            }

            if (!uriMatched)
                continue;

            this.setPage(page.name, args, pushState);
            return;
        }

        throw new Error('Cannot parse uri. No page found.');
    }

}
module.exports = Pager;

Object.defineProperties(Pager, {
    
    Page: { value: 
    class Pager_Page {

        constructor(name, uri, onPageSetListener) {
            Object.defineProperties(this, {
                name: { value: name, },
                uri: { value: uri, },
                onPageSetListener: { value: onPageSetListener, },
            });
        }

    }},

});