"use strict";

var loc = require('./loc.js');
var showScreen = require('./command.js').showScreen;

module.exports = {
    main:{
        prompt:[
            "What would you like to test?",
            "1) lexer",
            "2) parser"
        ],
        response: {
            "1": () => showScreen('lexer'),
            "2": () => showScreen('parser')
        }
    },
    
    
    lexer: {
        prompt:[
            "What case (file in test/cases folder)?"
        ],
        response: file => {
            loc.setStage('lexer', file);
            showScreen('lexerFile');
        }
    },
    
    
    lexerFile: {
        screen: () => loc.screen(),
        response: {
            "z": () => loc.previousFile()
        }
    }
};