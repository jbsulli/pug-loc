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
            "What case (file in test/cases folder)?",
            "(defaults to first file in folder)"
        ],
        response: file => {
            if(loc.setStage('lexer', file)){
                showScreen('lexerFile');
            } else {
                showScreen('lexerFileNotFound');
            }
        }
    },
    
    lexerFileNotFound: {
        prompt:[
            "Lexer file not found, please try again. What case?"
        ],
        response: file => {
            if(loc.setStage('lexer', file)){
                showScreen('lexerFile');
            } else {
                showScreen('lexerFileNotFound');
            }
        }
    },
    
    lexerFile: {
        screen: () => loc.screen(),
        response: {
            "z": () => { loc.previousFile(); },
            "c": () => { loc.nextFile(); },
            "s": () => { loc.nextToken(); },
            "w": () => { loc.previousToken(); },
            "j": () => { loc.setSettings({ json: !loc.settings.json }); },
            "a": () => { loc.moveEnd(-1); },
            "d": () => { loc.moveEnd(1); },
            "q": () => { loc.moveStart(-1); },
            "e": () => { loc.moveStart(1); },
            " ": () => { loc.saveExpected(); if(loc.run_pause === loc.pos) loc.run(); else loc.nextToken(); },
            "r": () => { loc.run(); }
        }
    },
    
    parser: {
        prompt:[
            "What case (file in test/cases folder)?",
            "(defaults to first file in folder)"
        ],
        response: file => {
            if(loc.setStage('parser', file)){
                showScreen('parserFile');
            } else {
                showScreen('parserFileNotFound');
            }
        }
    },
    
    parserFileNotFound: {
        prompt:[
            "parser file not found, please try again. What case?"
        ],
        response: file => {
            if(loc.setStage('parser', file)){
                showScreen('parserFile');
            } else {
                showScreen('parserFileNotFound');
            }
        }
    },
    
    parserFile: {
        screen: () => loc.screen(),
        response: {
            "z": () => { loc.previousFile(); },
            "c": () => { loc.nextFile(); },
            "s": () => { loc.nextToken(); },
            "w": () => { loc.previousToken(); },
            "j": () => { loc.setSettings({ json: !loc.settings.json }); },
            "a": () => { loc.moveEnd(-1); },
            "d": () => { loc.moveEnd(1); },
            "q": () => { loc.moveStart(-1); },
            "e": () => { loc.moveStart(1); },
            " ": () => { loc.saveExpected(); if(loc.run_pause === loc.pos) loc.run(); else loc.nextToken(); },
            "r": () => { loc.run(); }
        }
    }
};