"use strict";

const nodes = {
    NamedBlock: { nodes:[] },
    Block: { nodes:[] },
    Filter: { attrs:[] },
    Tag: { attrs:[], block:true },
    Case: { block:true },
    When: { block:true },
    Code: { block:true },
    Mixin: { block:true },
    InterpolatedTag: { block:true },
    While: { block:true },
    Each: { block:true, alternate:true },
    Conditional: { consequent:true, alternate:true },
    Include: { block:true, file:true },
    Extends: { file:true },
    RawInclude: { filters:[], file:true },
    Attrs: false,
    Attr: false,
    BlockComment: false,
    Comment: false,
    Doctype: false,
    IncludeFilter: false,
    MixinBlock: false,
    YieldBlock: false,
    Text: false,
    FileReference: { ast:true }
};

function walk(ast, callback){
    if(!((ast.type || 'Attr') in nodes)){
        throw new Error('Unknown node: ' + ast.type);
    }
    
    var node = nodes[ast.type];
    var sub, i;
    
    callback(ast);
    
    if(node){
        for(var attr in node){
            sub = ast[attr];
            if(!sub) continue;
            if(Array.isArray(node[attr])){
                for(i = 0; i < sub.length; i++){
                    walk(sub[i], callback);
                }
            } else {
                walk(sub, callback);
            }
        }
    }
}

module.exports = walk;