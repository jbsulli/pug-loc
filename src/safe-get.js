"use strict";

module.exports = safeGet;

function safeGet(val, path, type){
    path = path.split('.');
    while(path.length){
        if(!val || typeof val !== 'object') return;
        val = val[path.shift()];
    }
    
    if(typeof val === type) return val;
    
    if(type === 'int' && typeof val === 'number' && val | 0) return val;
    
    return;
}