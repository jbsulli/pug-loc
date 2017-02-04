"use strict";

module.exports.showScreen = showScreen;

const clear = require('clear');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const screens = require('./screens.js');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var response_handler;
var current_screen = 'main';
var redraw = 0;

function showScreen(screen_name){
    if(!screen_name){
        screen_name = current_screen;
    }
    
    if(!(screen_name in screens)){
        throw new Error('Invalid screen name: ' + screen_name);
    }
    
    var screen = screens[screen_name];
    
    clear();
    console.log(screen_name);
    current_screen = screen_name;
    redraw++;
    
    if(screen.screen){
        screen.screen();
    }
    
    if(screen.prompt){
        screen.prompt.forEach(function(prompt){
            if(typeof prompt === 'function'){
                prompt = prompt();
            }
            
            console.log(prompt);
        });
    }
    
    var response_type = 'function';
    
    if(typeof screen.response === 'object'){
        response_type = 'char';
        for(var response in screen.response){
            if(response.length > 1) response_type = 'string';
        }
    }
    
    switch(response_type){
        case 'char':
            response_handler = (input) => {
                var current_redraw = redraw;
                
                if(input in screen.response){
                    screen.response[input](input);
                } else
                if('*' in screen.response){
                    screen.response['*'](input);
                }
                
                if(redraw === current_redraw){
                    showScreen();
                }
            };
            break;
        case 'function':
        case 'string':
            response_handler = (input) => true;
            rl.question('', (input) => {
                var current_redraw = redraw;
                
                if(response_type === 'function'){
                    screen.response(input);
                    return;
                }
                
                if(input in screen.response){
                    screen.response[input](input);
                } else
                if('**' in screen.response){
                    screen.response['**'](input);
                }
                
                if(redraw === current_redraw){
                    showScreen();
                }
            });
            break;
    }
}

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', function(key){
    fs.writeFileSync(path.join(__dirname, '..', 'save', 'lastkey.json'), JSON.stringify(key), 'utf8');
    
    switch(key){
        case '\u0003':
            process.exit(1);
            return;
    }
    
    if(!response_handler(key)){
        rl.write(null, {ctrl: true, name: 'u'});
    }
});