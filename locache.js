/*jshint asi:true */

//      locache VERSION-PLACEHOLDER
//
//      (c) 2012 Dougal Matthews
//      locache may be freely distributed under the MIT licence.
//
//      locache is a client side caching framework that stores data
//      with DOM Storage and proves a memcache inspired API for
//      setting and retrieving values.

//

(function(){

    "use strict";

    // Initial Setup
    // --------------------

    // Save a reference to the global window object.
    var root = this

    function LocacheCache(options){

        for (var key in options) {
            if (options.hasOwnProperty(key)) {
                this[key] = options[key]
            }
        }

    }

    // The top-level namespace. All public locache objects will be
    // attached to this object.
    var locache = new LocacheCache()

    // Attach the locache namespace to the global window object.
    root.locache = locache

    // Current version of locache. Keep this in sync with the version
    // at the top of this file.
    LocacheCache.prototype.VERSION = "VERSION-PLACEHOLDER"

    // Boolean value that determines if they browser supports localStorage or
    // not. This is based on the Modernizr implementation that can be found
    // in [the Modernizr GitHub repository.](https://github.com/Modernizr/Modernizr/blob/c56fb8b09515f629806ca44742932902ac145302/modernizr.js#L696-731)
    LocacheCache.prototype.supportsLocalStorage = (function() {

        try {
            // Create a test value and attempt to set, get and remove the
            // value. These are the core functionality required by locache.
            var test_val = "___locache___"
            window.localStorage.setItem(test_val, test_val)
            window.localStorage.getItem(test_val)
            window.localStorage.removeItem(test_val)
            // If any of the checks fail, an exception will be raised. At
            // that point we can flag the browser as not supporting
            // localStorage.
            return true
        } catch(e) {
            return false
        }

    })()

    // Boolean value that determines if they browser supports sessionStorage or
    // not. This is based on the Modernizr implementation that can be found
    // in [the Modernizr GitHub repository.](https://github.com/Modernizr/Modernizr/blob/c56fb8b09515f629806ca44742932902ac145302/modernizr.js#L696-731)
    LocacheCache.prototype.supportsSessionStorage = (function() {

        try {
            // Create a test value and attempt to set, get and remove the
            // value. These are the core functionality required by locache.
            var test_val = "___locache___"
            window.sessionStorage.setItem(test_val, test_val)
            window.sessionStorage.getItem(test_val)
            window.sessionStorage.removeItem(test_val)
            // If any of the checks fail, an exception will be raised. At
            // that point we can flag the browser as not supporting
            // sessionStorage.
            return true
        } catch(e) {
            return false
        }

    })()

    // Boolean flag to check if the browser supports native JSON.
    LocacheCache.prototype.supportsNativeJSON = !!window.JSON

    // Internal utility functions
    // --------------------

    // Two cache prefixes. When storing values, all keys are prefixed
    // to avoid collisions with other usage of the storage backend.
    // If the stored value is given an expire time then a second key
    // is set with a different prefix to store this time.
    LocacheCache.prototype.cachePrefix = '___locache___'
    LocacheCache.prototype.expirePrefix = '___locacheExpire___'

    // Built in locache backends. These are simple wrappers around the actual
    // storage mechanism to allow for them to be easily exchanged.

    LocacheCache.prototype.backends = {
        // Wrapper around localStorage - persistent local storage in the
        // browser.
        local: {
            set : function(key, value){
                return window.localStorage.setItem(key, value)
            },

            get : function(key, value){
                return window.localStorage.getItem(key)
            },

            remove : function(key){
                return window.localStorage.removeItem(key)
            },

            length : function(key){
                return window.localStorage.length
            },

            key : function(index){
                if (index < 0 || index >= this.length()){
                    return
                }
                return window.localStorage.key(index)
            },
            enabled: function(){
                return locache.supportsLocalStorage
            }
        },
        // Wrapper around sessionStorage - storage in the browser that is
        // cleared each time a new session is started - new browser window etc.
        session : {
            set : function(key, value){
                return window.sessionStorage.setItem(key, value)
            },

            get : function(key, value){
                return window.sessionStorage.getItem(key)
            },

            remove : function(key){
                return window.sessionStorage.removeItem(key)
            },

            length : function(key){
                return window.sessionStorage.length
            },

            key : function(index){
                if (index < 0 || index >= this.length()){
                    return
                }
                return window.sessionStorage.key(index)
            },
            enabled: function(){
                return locache.supportsSessionStorage
            }
        }
    }

    LocacheCache.prototype.storage = locache.backends.local;

    // Utility method to get the number of milliseconds since the Epoch. This
    // is used when comparing keys to see if they have expired.
    var _currentTime = function(){
        return new Date().getTime()
    }

    // Given a key, return the key used internally for storing values without
    // the risk of collisions over usage of the storage backend.
    LocacheCache.prototype.key = function(key){
        return this.cachePrefix + key
    }

    // Given a key, return the key to be used internally for expiry time.
    LocacheCache.prototype.expirekey = function(key){
        return this.expirePrefix + key
    }

    // Given a key, look up its expire time and determine if its in the past
    // or not. Returns a Boolean.
    LocacheCache.prototype.hasExpired = function(key){

        var expireKey = this.expirekey(key)
        var expireValue = parseInt(this.storage.get(expireKey), 10)

        // If we have non-zero integer perform the comparison.
        if (expireValue && expireValue < _currentTime()){
            return true
        }

        return false

    }

    // Main public API functions.
    // --------------------

    // Given a key, a value and an optional number of seconds store the value
    // in the storage backend.
    LocacheCache.prototype.set = function(key, value, seconds){

        // If the storage backend isn't supported or the key passed in is
        // falsy, perform a no-op.
        if (!this.storage.enabled() || !key) return

        var expireKey = this.expirekey(key)
        var valueKey = this.key(key)

        if(seconds){
            // The time stored is in milliseconds, but this function expects
            // seconds, so multiply by 1000.
            var ms = seconds * 1000
            this.storage.set(expireKey, _currentTime() + ms)
        }

        // For the value, always convert it into a JSON object. THis means
        // that we can safely store many types of objects. They still need to
        // be serialisable so it still rules out some, such as functions.
        value = JSON.stringify(value)
        this.storage.set(valueKey, value)

    }

    // Fetch a value from the cache. Either returns the value, or if it
    // doesn't exist (or has expired) return null.
    LocacheCache.prototype.get = function(key){

        // If the storage backend isn't enabled perform a no-op.
        if (!this.storage.enabled()) return null

        // If the value has expired, before returning null remove the key
        // from the storage backend to free up the space.
        if (this.hasExpired(key)){
            this.remove(this.key(key))
            return null
        }

        var valueKey = this.key(key)
        var value = this.storage.get(valueKey)

        // After we have the value back, check its truthy and then attempt to
        // parse the JSON. If the JSON parsing fails, return null. This could
        // be handled better but its hard to know what to do here? We only
        // set JSON and thus we expect JSON but we don't want to delete
        // values that must have come from another source.
        if (value){
            try{
                return JSON.parse(value)
            } catch(err){
                return null
            }
        }

        // If value isn't truthy, it must be an empty string or similar, so
        // just return that.
        return value

    }

    // When removing a key - delete from the storage both the value key/value
    // pair and the expiration time key/value pair.
    LocacheCache.prototype.remove = function(key){

        // If the storage backend isn't enabled perform a no-op.
        if (!this.storage.enabled()) return

        var expireKey = this.expirekey(key)
        var valueKey = this.key(key)

        this.storage.remove(expireKey)
        this.storage.remove(valueKey)

    }

    // Given a key name, fetch it, increment the value and store it again. If
    // the counter hasn't be initialised yet, set it to zero and then perform
    // the increment. The fetched value is always parsed as an int to make
    // sure the increment will work - this means if a non-int was stored, it
    // will be converted first and thus reset the counter to zero.
    LocacheCache.prototype.incr = function(key){

        // If the storage backend isn't enabled perform a no-op.
        if (!this.storage.enabled()) return

        var current = parseInt(this.get(key), 10)
        if (!current){
            current = 0
        }
        current ++
        this.set(key, current)
        return current

    }

    // Exactly the same as the incr function, but with a decrementing value.
    LocacheCache.prototype.decr = function(key){

        // If the storage backend isn't enabled perform a no-op.
        if (!this.storage.enabled()) return

        var current = parseInt(this.get(key), 10)
        if (!current){
            current = 0
        }
        current --
        this.set(key, current)
        return current

    }

    // Given a properties object, in the form of {key: value, key:value} set
    // multiple keys.
    LocacheCache.prototype.setMany = function(properties, seconds){

        // If the storage backend isn't enabled perform a no-op.
        if (!this.storage.enabled()) return

        // Iterate through all the object properties.
        for (var key in properties) {
            // Ignore any inherited properties, by making sure they are in
            // the given objecct.
            if (properties.hasOwnProperty(key)) {
                this.set(key, properties[key], seconds)
            }
        }

    }

    // Given an array of keys, return an array of values. If values don't
    // exist, null will be in their place.
    LocacheCache.prototype.getMany = function(keys){

        var results = []

        for (var i=0; i < keys.length; i++){
            // To ensure that the correct structure is returned, if
            // the storage backend isn't enabled return an array of null
            // values with the correct length.
            if (this.storage.enabled()){
                results.push(this.get(keys[i]))
            } else {
                results.push(null)
            }
        }

        return results

    }

    // Given an array of keys, remove all of them from the cache.
    LocacheCache.prototype.removeMany = function(keys){

        // If the storage backend isn't enabled perform a no-op.
        if (!this.storage.enabled()) return

        for (var i=0; i < keys.length; i++){
            this.remove(keys[i])
        }

    }

    // Delete all stored values from the cache. This method will only remove
    // values added to the storage backend with the locache prefix in the key.
    LocacheCache.prototype.flush = function(){

        // If the storage backend isn't enabled perform a no-op.
        if (!this.storage.enabled()) return

        var length = this.storage.length()
        var prefix = this.cachePrefix

        // Iteratate through all the keys stored in the storage backend - if
        // the key tarts with the prefix cache prefix, then remove that key.
        for (var i=0; i < length; i++) {
            var key = this.storage.key(i)
            if (key && key.indexOf(prefix) === 0) this.storage.remove(key)
        }

    }

    // Return the number of cache values stored in the storage backend. This
    // only calculates the values stored by locache.
    LocacheCache.prototype.length = function(){

        // If the storage backend isn't supported perform a no-op and return
        // zero.
        if (!this.storage.enabled()) return 0

        var c = 0
        var length = this.storage.length()
        var prefix = this.cachePrefix

        for (var i=0; i < length; i++) {
            if (this.storage.key(i).indexOf(prefix) === 0) c++
        }

        return c

    }

    // A cleanup utility method to remove expired keys. Iterate through all
    // the keys stored in the storage backend. If they key is a locache key
    // (it has the prefix) then check to see if the key has expired. If it
    // has, remove the key from the cache.
    LocacheCache.prototype.cleanup = function(){

        // If the storage backend isn't enabled perform a no-op.
        if (!this.storage.enabled()) return

        var length = this.storage.length()
        var prefix = this.cachePrefix

        for (var i=0; i < length; i++) {
            var key = this.storage.key(i)
            // If the key matches, remove the prefix to get the original key
            // and then make use of the normal remove method that will clean
            // up the cache value key pair and the cache epiration time key
            // pair.
            if (key && key.indexOf(prefix) === 0){
                var actualKey = key.substring(prefix.length, key.length)
                if (this.hasExpired(actualKey)){
                    this.remove(actualKey)
                }
            }
        }

    }

    LocacheCache.prototype.createCache = function(options){
        return new LocacheCache(options)
    }

    locache.session = new LocacheCache({
        storage: locache.backends.session
    })


}).call(this);