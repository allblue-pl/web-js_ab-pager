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

        if (uriArray.length === 0)
            uriArray.push('');

        for (let [ pageName, page ] of this._pages) {
            let aliasArray = page.uri.split('/');

            if (aliasArray.length !== uriArray.length)
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
        js0.args(arguments, 'string', [ 'object', js0.Default ]);

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

    page(name, uri, onPageSetListener)
    {
        js0.args(arguments, 'string', 'string', 'function');

        this._pages.set(name, new Pager.Page(name, uri));
        
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
                    args_Parsed[argInfo.name] = null;

                continue;
            }

            pUri += encodeURIComponent(args[argInfo.name]) + '/';

            if (args_Parsed !== null)
                args_Parsed[argInfo.name] = String(args[argInfo.name]);
        }

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

    setPage(pageName, args = {}, searchParams = {}, pushState = true, pageArgs = {})
    {
        js0.args(arguments, 'string', [ js0.Default, 'object' ], 
                [ js0.Default, 'object' ], [ js0.Default, 'boolean' ], 
                [ js0.Default, js0.RawObject ]);

        if (!this._pages.has(pageName))
            throw new Error('Page `' + pageName + '` does not exist.`');

        let args_Parsed = {};
        for (let argName in args)
            args_Parsed[argName] = String(args[argName]);
        args = args_Parsed;

        for (let listenerFn of this._listeners_OnBeforePageSet) {
            if (listenerFn(pageName, args, searchParams, pushState) === false)
                return;
        }

        let source = this._currentPage;
        this._currentPage = this._pages.get(pageName);

        let uri = this.parseUri(this._currentPage.uri, args, searchParams);

        this._currentPageInfo = new Pager.PageInfo(pageName, args, searchParams);

        if (this._useState) {
            if (pushState)
                window.history.pushState({}, this._currentPage.title, uri);
            else
                window.history.replaceState({}, this._currentPage.title, uri);
        }

        // let currentPage = {
        //     name: this._currentPageInfo.name,
        //     args: this._currentPageInfo.args,
        //     searchParams: this._currentPageInfo.searchParams,
        // };

        for (let i = 0; i < this._listeners_OnPageChanged.length; i++)
            this._listeners_OnPageChanged[i](this._currentPageInfo, source);
        if (this._currentPageInfo.name in this._listeners_OnPageSet) {
            this._listeners_OnPageSet[this._currentPageInfo.name](
                    this._currentPageInfo, source, pageArgs);

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
            this.setPage(pageInfo.name, pageInfo.args, pageInfo.searchParams, pushState);
        }
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
            for (let searchParamsName in this._searchParams)
                searchParams[searchParamsName] = this._searchParams[argName];

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