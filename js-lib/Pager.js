'use strict';

const
    js0 = require('js0')
;

class Pager
{

    get base() {
        return this._base;
    }

    get current() {
        return this._currentPageInfo;
    }

    get pages() {
        return this._pages;
    }


    constructor(base = '/', useState = true)
    {
        this._initialized = false;

        this._base = base;
        this._useState = useState;
        this._pages = new Map();

        this._currentPage = null;
        this._currentPageInfo = null;

        this._listeners_OnPageChanged = [];
        this._listeners_OnPageSet = {};
        this._listeners_OnBeforePageSet = [];

        this._listeners_NotFound = null;
    }

    addListener_OnBeforePageSet(listenerFn)
    {
        this._listeners_OnBeforePageSet.push(listenerFn);
    }

    addListener_OnPageChanged(listenerFn) {
        this._listeners_OnPageChanged.push(listenerFn);
    }

    clearPages()
    {
        this._pages.clear();

        return this;
    }

    getPage(pageName)
    {
        js0.args(arguments, 'string');

        if (!this._pages.has(pageName))
            throw new Error(`Page '${pageName}' does not exist.`);

        return this._pages.get(pageName);
    }

    getPageInfo_FromUri(uri)
    {
        if (this._pages.size === 0)
            throw new Error(`Cannot parse uri '${uri}'. No pages set.`);

        let base = this._base;
        base = base.substring(0, base.length);

        if (uri.indexOf(base) !== 0) {
            window.location = base;
            return null;
        }

        uri = uri.substring(base.length);
        
        let uriArr = uri.split('?');
        uri = uriArr[0];
        let search = uriArr.length === 1 ? '' : uriArr[1];

        let searchParams = {};
        let searchArr = search.split('&');
        for (let searchParam of searchArr) {
            let searchParamArr = searchParam.split('=');
            if (searchParamArr.length < 2)
                continue;
            
            searchParams[searchParamArr[0]] = searchParamArr[1];
        }

        let uriArray = uri.split('/');
        if (uriArray[uriArray.length - 1] === '')
            uriArray.pop();

        // if (uriArray.length === 0 && !page.extraArg)
        //     uriArray.push('');

        for (let [ pageName, page ] of this._pages) {
            let aliasArray = page.uri.split('/');
            if (aliasArray[aliasArray.length - 1] === '')
                aliasArray.pop();

            if (page.extraArg) {
                if (aliasArray.length > uriArray.length)
                    continue;
            } else {
                if (aliasArray.length !== uriArray.length)
                    continue;
            }

            let args = {};
            let uriMatched = true;

            for (let i = 0; i < aliasArray.length; i++) {
                if (uriArray[i] === '') {
                    uriMatched = aliasArray[i] === '';
                    break;
                }

                if (aliasArray[i][0] === ':') {
                    if (aliasArray[i][0] === 1) {
                        uriMatched = false;
                        break;
                    }

                    let uriArgInfo = this._getUriArgInfo(aliasArray[i]);

                    args[uriArgInfo.name] = decodeURIComponent(uriArray[i]);
                    continue;
                }

                if (aliasArray[i] !== uriArray[i]) {
                    uriMatched = false;
                    break;
                }
            }

            if (!uriMatched)
                continue;

            if (page.extraArg)
                args['*'] = uriArray.slice(aliasArray.length).join('/');

            return {
                name: page.name,
                args: args,
                searchParams: searchParams,
            };
        }

        return null;
    }

    getPageUri(pageName, args = {}, searchParams = {}, pathOnly = false)
    {
        js0.args(arguments, 'string', [ 'object', js0.Default ], 
                [ 'object', js0.Default ], [ 'boolean', js0.Default ]);

        let page = this.getPage(pageName);

        return this.parseUri(page.uri, args, searchParams, null, null, pathOnly);
    }

    hasPage(pageName)
    {
        js0.args(arguments, 'string');

        return this._pages.has(pageName);
    }

    init(setPage = true)
    {
        this._initialized = true;

        if (this._useState) {
            window.onpopstate = () => {
                this._parseUri(window.location.pathname + window.location.search, false);
            };
        }

        let uri = window.location.pathname + window.location.search;
        let pageInfo = this.getPageInfo_FromUri(uri);
        if (!setPage)
            return pageInfo;

        this._setPageInfo(pageInfo, false, uri);
    }

    notFound(notFoundListener)
    {
        js0.args(arguments, 'function');

        this._listeners_NotFound = notFoundListener;
    }

    page(name, uri, onPageSetListener = null)
    {
        js0.args(arguments, 'string', 'string', [ 'function', js0.Null ]);

        this._pages.set(name, new Pager.Page(name, uri, onPageSetListener));
        
        if (onPageSetListener !== null) {
            this._listeners_OnPageSet[name] = onPageSetListener;
            // this._listeners_OnPageChanged.push((page, sourcePageName) => {
            //     if (page.name === name)
            //         onPageSetListener(sourcePageName);
            // });
        }

        return this;
    }

    parseUri(uri, args = {}, searchParams = {}, args_Parsed = null, 
            searchParams_Parsed = null, pathOnly = false)
    {   
        let uriArr = uri.split('?');
        uri = uriArr[0];

        /* Uri Args */
        let uriArgs = uri === '' ? [] : uri.split('/');
        if (uriArgs[uriArgs.length - 1] === '')
            uriArgs.pop();

        let pUri = '';
        for (let i = 0; i < uriArgs.length; i++) {
            if (uriArgs[i][0] !== ':') {
                pUri += uriArgs[i] + '/';
                continue;
            }

            let argInfo = this._getUriArgInfo(uriArgs[i]);

            if (!(argInfo.name in args)) {
                if (argInfo.defaultValue === null)
                    throw new Error(`Uri arg '${argInfo.name}' not set.`);

                pUri += argInfo.defaultValue + '/';
                args[argInfo.name] = argInfo.defaultValue;

                if (args_Parsed !== null)
                    args_Parsed[argInfo.name] = String(args[argInfo.name]);

                continue;
            }

            pUri += encodeURIComponent(args[argInfo.name]) + '/';

            if (args_Parsed !== null)
                args_Parsed[argInfo.name] = String(args[argInfo.name]);
        }
        if ('*' in args) 
            pUri += args['*'];

        /* Search Params */
        let search = '';
        for (let searchParam_Name in searchParams) {
            search += (search === '' ? '?' : '&') + searchParam_Name + '=' +
                    searchParams[searchParam_Name];
        }

        pUri += search;

        if (pathOnly)
            return pUri;
        else
            return this._base + pUri;
    }

    parseUri_PathOnly(uri, args = {}, searchParams = {}, args_Parsed = null, 
        searchParams_Parsed = null)
    {   
        return this.parseUri(uri, args, searchParams, args_Parsed, 
                searchParams_Parsed, true);
    }

    removeListener_OnBeforePageSet(listenerFn)
    {
        for (let i = 0; i < this._listeners_OnBeforePageSet.length; i++) {
            if (this._listeners_OnBeforePageSet[i] === listenerFn) {
                this._listeners_OnBeforePageSet.splice(i, 1);
                return;
            }
        }

        throw new Error(`Listener function does not exist.`);
    }

    setPage(pageName, uriArgs = {}, searchParams = {}, pushState = true, 
            pageArgs = {}, skipOnPageChangedListener = false, 
            skipOnPageSetListener = false)
    {
        js0.args(arguments, 'string', [ js0.Default, 'object' ], 
                [ js0.Default, 'object' ], [ js0.Default, 'boolean' ], 
                [ js0.Default, js0.RawObject ], [ js0.Default, 'boolean' ],
                [ js0.Default, 'boolean' ]);

        if (!this._pages.has(pageName))
            throw new Error('Page `' + pageName + '` does not exist.`');

        for (let argName in uriArgs) {
            uriArgs[argName] = uriArgs[argName] === null ? 
                null : String(uriArgs[argName]);
        }

        let newPage = this._pages.get(pageName);
        let uriArgs_Parsed = {};
        let uri = this.parseUri(newPage.uri, uriArgs, searchParams, uriArgs_Parsed);
        uriArgs = uriArgs_Parsed;

        for (let listenerFn of this._listeners_OnBeforePageSet) {
            if (listenerFn(pageName, uriArgs, searchParams, pushState) === false)
                return;
        }

        let source = this._currentPage;
        this._currentPage = newPage;

        this._currentPageInfo = new Pager.PageInfo(pageName, uriArgs, searchParams);

        if (this._useState) {
            if (pushState)
                window.history.pushState({}, '', uri);
            else
                window.history.replaceState({}, '', uri);
        }

        // let currentPage = {
        //     name: this._currentPageInfo.name,
        //     args: this._currentPageInfo.args,
        //     searchParams: this._currentPageInfo.searchParams,
        // };

        if (!skipOnPageChangedListener) {
            for (let i = 0; i < this._listeners_OnPageChanged.length; i++)
                this._listeners_OnPageChanged[i](this._currentPageInfo, source);
        }

        if (!skipOnPageSetListener) {
            if (this._currentPageInfo.name in this._listeners_OnPageSet) {
                this._listeners_OnPageSet[this._currentPageInfo.name](
                        this._currentPageInfo, source, pageArgs);
            }
        }
    }

    setUri(uri, pushState = true)
    {
        this._parseUri(uri, pushState);
    }


    _getUriArgInfo(uriArg)
    {
        let argName = uriArg.substring(1);
        let argDefault = null;
        let argNameArray = argName.split('=');
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
        let pageInfo = this.getPageInfo_FromUri(uri);

        this._setPageInfo(pageInfo, pushState, uri);
    }

    _setPageInfo(pageInfo, pushState, uri)
    {
        js0.args(arguments, js0.RawObject, [ 'boolean', js0.Default ], 'string');

        if (pageInfo === null) {
            if (this._listeners_NotFound === null)
                throw new Error(`Cannot parse uri '${uri}'. No page found.`);
            else
                this._listeners_NotFound(uri, pushState);
        } else {
            this.setPage(pageInfo.name, pageInfo.args, pageInfo.searchParams, 
                    pushState);
        }
    }

}
module.exports = Pager;

Object.defineProperties(Pager, {
    
    Page: { value: 
    class Pager_Page {

        constructor(name, uri, onPageSetListener) {
            let extraArg = false;

            if (uri.indexOf('*') !== -1) {
                extraArg = true;

                if (uri.indexOf('*') !== uri.length - 1) 
                    throw new Error(`'*' must be the last character of uri.`);

                if (uri.indexOf('*') === uri.length - 1) {
                    if (uri.length === 1) {
                        uri = '';
                    } else {
                        if (uri.indexOf('/*') !== uri.length - 2)
                            throw new Error(`'*' must be a separate uri element.`);
                        uri = uri.substring(0, uri.length - 2);
                    }
                }
            }

            Object.defineProperties(this, {
                name: { value: name, },
                uri: { value: uri, },
                onPageSetListener: { value: onPageSetListener, },
                extraArg: { value: extraArg, },
            });
        }

    }},

    PageInfo: { value:
    class Pager_PageInfo {

        get args() {
            let argsR = {};
            for (let argName in this._args)
                argsR[argName] = this._args[argName];

            return argsR;
        }

        get name() {
            return this._name;
        }

        get searchParams() {
            let searchParamsR = {};
            for (let searchParamName in this._searchParams)
                searchParamsR[searchParamName] = this._searchParams[searchParamName];

            return searchParamsR;
        }


        constructor(pageName, args, searchParams)
        {
            this._name = pageName;
            this._args = args;
            this._searchParams = searchParams;
        }
        
    }},

});