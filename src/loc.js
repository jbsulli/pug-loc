"use strict";

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const exec = require('child_process').execSync;
const safeGet = require('./safe-get.js');
const walk = require('./walk.js');

function Loc(){
    this.stage = 'lexer';
    this.file = '';
    this.pug = undefined;
    
    this.plugin = {
        postLex: tokens => { this.lexer_tokens = tokens; if(this.stage === 'lexer') throw true; return tokens; },
        postParse: ast => { this.parser_ast = ast; if(this.stage === 'parser') throw true; return ast; }
    };
    
    this.settings = {
        json:true
    };
    
    try {
        this.settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
    } catch(err){}
    
    this.reload();
}

Loc.prototype.fixEndpoints = function(loc, save, min_line){
    if(!min_line || min_line < 1) min_line = 1;
    
    // if the line matches the start line, use the start column
    if(min_line > loc[1]){
        this.setPos(save, min_line);
    } else {
        this.setPos(save, loc[1], loc[2]);
    }
    
    if(loc[3] >= save[1]){
        this.setPos(save, loc[3], loc[4], 2);
    } else {
        this.setPos(save, loc[1], loc[2], 2);
    }
    
    if(save[1] === save[3] && save[4] < save[2]){
        save[4] = save[2];
    }
};

Loc.prototype.setColumn = function(loc, column, offset){
    offset = offset || 0;
    
    if(column < 1) column = 1;
    else if(column > this.lines[loc[offset + 1] - 1].length + 1) column = this.lines[loc[offset + 1] - 1].length + 1;
    
    loc[offset + 2] = column;
};

Loc.prototype.setLineStart = function(loc, line, offset){
    offset = offset || 0;
    
    if(line < 1) line = 1;
    else if(line > this.lines.length) line = this.lines.length;
    
    loc[offset + 1] = line;
    loc[offset + 2] = 1;
};

Loc.prototype.setPos = function(loc, line, column, offset){
    this.setLineStart(loc, line, offset);
    this.setColumn(loc, column, offset);
};

Loc.prototype.getFiles = function(){
    const dir = path.join(process.cwd(), 'packages');
    
    switch(this.stage){
        case 'lexer':
        case 'parser': 
            this.pug_src_dir = path.join(dir, 'pug-lexer', 'test', 'cases');
            break;
        default: throw new Error('implement');
    }
    
    this.files = [];
    
    fs.readdirSync(this.pug_src_dir).forEach(file => {
        var src = path.join(this.pug_src_dir, file);
        if(fs.statSync(src).isFile()){
            this.files.push(file);
        }
    });
};

Loc.prototype.getLexerLocs = function(){
    this.locs = [];
    this.tokens = [];
    this.lexer_tokens.forEach(token => {
        this.tokens.push(token);
        this.locs.push([
            safeGet(token, 'loc.filename', 'string'),
            safeGet(token, 'loc.start.line', 'int'),
            safeGet(token, 'loc.start.column', 'int'),
            safeGet(token, 'loc.end.line', 'int'),
            safeGet(token, 'loc.end.column', 'int')
        ]);
    });
};

Loc.prototype.getNodes = function(){
    this.pug_src_file = this.files[this.file];
    
    if(!this.pug_src_file) return;
    
    this.pug_src = fs.readFileSync(path.join(this.pug_src_dir, this.pug_src_file), 'utf8');
    this.lines = this.pug_src.split(/(?:\r\n|\n|\r)/g);
    this.locs_expected = [];
    
    try {
        var dir = path.join(__dirname, '..', 'save', this.repo.dir, this.repo.branch, this.stage, this.pug_src_file.replace(/\.pug$/, '') + '.expected.txt');
        var expected = fs.readFileSync(dir, 'utf8').split('\n');
        var data = JSON.parse(expected.shift());
        if(data[0] !== this.repo.url || data[1] !== this.repo.branch || data[2] !== this.stage || data[3] !== this.pug_src_file){
            throw new Error('Expected locations file header did not match current location. [' + dir + ']\n' + JSON.stringify(data) + '\n' + JSON.stringify([this.repo.url, this.repo.branch, this.stage, this.pug_src_file]));
        }
        while(expected.length){
            var line = expected.shift().match(/(.*),([0-9]+),([0-9]+),([0-9]+),([0-9]+)$/);
            if(line){
                this.locs_expected.push([line[1], parseInt(line[2]), parseInt(line[3]), parseInt(line[4]), parseInt(line[5])]);
            } else {
                this.locs_expected.push(undefined);
            }
        }
    } catch(err){
        if(err.code !== 'ENOENT') throw err;
    }
    
    try {
        this.rendered = this.pug.render(this.pug_src, { plugins: [this.plugin], filename:this.pug_src_file });
    } catch(err){
        if(err !== true){
            throw err;
        }
    }

    switch(this.stage){
        case 'lexer': this.getLexerLocs(); break;
        case 'parser': this.getParserLocs(); break;
        default: throw new Error('implement');
    }
};

Loc.prototype.getParserLocs = function(){
    this.locs = [];
    this.tokens = [];
    
    walk(this.parser_ast, (node) => {
        this.tokens.push(node);
        this.locs.push([
            safeGet(node, 'loc.filename', 'string'),
            safeGet(node, 'loc.start.line', 'int') || 1,
            safeGet(node, 'loc.start.column', 'int') || 1,
            safeGet(node, 'loc.end.line', 'int') || 1,
            safeGet(node, 'loc.end.column', 'int') || 1
        ]);
    });
};

Loc.prototype.getRepoData = function(){
    this.repo = undefined;
    var repo = exec('git config --get remote.origin.url', { encoding:'utf8' }).replace(/[\r\n \t]+/g, '');
    var branch = exec('git rev-parse --abbrev-ref HEAD', { encoding:'utf8' }).replace(/[\r\n \t]+/g, '');
    
    this.repo = {
        url: repo,
        branch: branch
    };
    
    var match = repo.match(/^https\:\/\/github\.com\/([^\/]+)\/([^\/]+)\.git$/);
    
    if(match){
        this.repo.dir = match[1] + '-' + match[2];
    } else {
        this.repo.dir = this.repo.replace(/[^a-zA-Z0-9_\-]/g, '-').replace(/--+/g, '');
    }
};

Loc.prototype.moveEnd = function(amount){
    var off = (amount < 0 ? -1 : 1);
    while(amount !== 0){
        amount -= off;
        this.save[4] += off;
        if(this.save[4] < 1){
            this.save[3]--;
            if(this.save[3] < 1){
                this.save[3] = 1;
                this.save[4] = 1;
                amount = 0;
            } else {
                this.save[4] = this.lines[this.save[3] - 1].length + 1;
            }
        }
        else if(this.save[4] > this.lines[this.save[3] - 1].length + 1){
            this.save[3]++;
            if(this.save[3] > this.lines.length){
                this.save[3] = this.lines.length;
                this.save[4] = this.lines[this.lines.length - 1].length + 1;
                amount = 0;
            } else {
                this.save[4] = 1;
            }
        }
    }
    if(this.save[1] > this.save[3] || (this.save[1] === this.save[3] && this.save[2] > this.save[4])){
        this.save[1] = this.save[3];
        this.save[2] = this.save[4];
    }
};

Loc.prototype.moveStart = function(amount){
    var off = (amount < 0 ? -1 : 1);
    while(amount !== 0){
        amount -= off;
        this.save[2] += off;
        if(this.save[2] < 1){
            this.save[1]--;
            if(this.save[1] < 1){
                this.save[1] = 1;
                this.save[2] = 1;
                amount = 0;
            } else {
                this.save[2] = this.lines[this.save[1] - 1].length + 1;
            }
        }
        else if(this.save[2] > this.lines[this.save[1] - 1].length + 1){
            this.save[1]++;
            if(this.save[1] > this.lines.length){
                this.save[1] = this.lines.length;
                this.save[2] = this.lines[this.lines.length - 1].length + 1;
                amount = 0;
            } else {
                this.save[2] = 1;
            }
        }
    }
    if(this.save[1] > this.save[3] || (this.save[1] === this.save[3] && this.save[2] > this.save[4])){
        this.save[3] = this.save[1];
        this.save[4] = this.save[2];
    }
};

Loc.prototype.nextFile = function(){
    this.file++;
    this.getNodes();
    this.pos = 0;
    this.prepToken();
    
    return true;
};

Loc.prototype.nextToken = function(){
    this.pos++;
    
    if(this.pos >= this.locs.length){
        this.nextFile();
        return;
    }
    
    this.prepToken();
};

Loc.prototype.prepToken = function(){
    while(this.pos >= this.locs.length){
        delete this.running;
        this.pos--;
    }
    
    const a = this.locs[this.pos];
    const e = (this.locs_expected && this.locs_expected.length > this.pos && this.locs_expected[this.pos] ? this.locs_expected[this.pos] : ['??', -1, -1, -1 , -1]);
    
    var match = a[0] === e[0] && a[1] === e[1] && a[2] === e[2] && a[3] === e[3] && a[4] === e[4];
    
    if(match && this.running && this.run_pause !== this.pos){
        this.run_pause = -1;
        this.nextToken();
        return;
    }
    
    var use_actual = e[3] === -1 || e[4] === -1 || e[1] === -1 || e[0] === -1;
    var save = [a[0], a[1], a[2], a[3], a[4]];
    
    this.fixEndpoints((use_actual ? a : e), save);
    
    this.match = match;
    this.actual = a;
    this.expected = e;
    this.save = save;
    
    if(this.running){
        this.run_pause = this.pos;
        delete this.running;
    }
};

Loc.prototype.previousFile = function(){
    this.file--;
    this.getNodes();
    this.pos = 0;
    this.prepToken();
    
    return true;
};

Loc.prototype.previousToken = function(){
    this.pos--;
    
    if(this.pos < 0){
        this.previousFile();
        this.pos = this.locs.length - 1;
    }
    
    this.prepToken();
};

Loc.prototype.run = function(){
    this.running = true;
    this.nextToken();
};

Loc.prototype.saveExpected = function(){
    if(!this.locs_expected){
        this.locs_expected = [];
    }
    
    this.locs_expected[this.pos] = this.save;
    
    var dir = path.join(__dirname, '..', 'save');
    var file = this.pug_src_file.replace(/\.pug$/, '');
    var dirs = [this.repo.dir, this.repo.branch, this.stage];
    var s = JSON.stringify([this.repo.url, this.repo.branch, this.stage, this.pug_src_file]) + '\n';
    
    while(dirs.length){
        dir = path.join(dir, dirs.shift());
        try {
            fs.mkdirSync(dir);
        } catch(err){
            if(err.code !== 'EEXIST') throw err;
        }
    }
    
    for(var i = 0; i < this.locs_expected.length; i++){
        s += (this.locs_expected[i] || []).join(',') + '\n';
    }
    
    fs.writeFileSync(path.join(dir, file + '.expected.txt'), s.substr(0, s.length - 1));
    
    this.prepToken();
};

Loc.prototype.screen = function(){
    if(!this.pug_src_file){
        console.log('No more files to process.');
        return;
    }
    
    if(this.pos >= this.locs.length){
        process.nextTick(() => this.nextFile());
        return;
    }
    
    const tok = this.tokens[this.pos];
    const match = this.match;
    const a = this.actual;
    const e = this.expected;
    const save = this.save;
    
    console.log(chalk.gray(this.repo.url + ' ' + this.repo.branch + ' ' + this.stage));
    if(match){
        console.log(chalk.green(this.pug_src_file.replace(/\.pug$/, '')), chalk.gray('@'), chalk.white(this.pos + 1));
    } else {
        console.log(chalk.red(this.pug_src_file.replace(/\.pug$/, '')), chalk.gray('@'), chalk.white(this.pos + 1));
    }
    console.log(chalk.gray('  actual:'), chalk.white(`${a[1]}:${a[2]}`) + chalk.gray(' to ') + chalk.white(`${a[3]}:${a[4]}`));
    console.log(chalk.gray('expected:'), chalk.white(`${e[1] === -1 ? '??' : e[1]}:${e[2] === -1 ? '??' : e[2]}`) + chalk.gray(' to ') + chalk.white(`${e[3] === -1 ? '??' : e[3]}:${e[4] === -1 ? '??' : e[4]}`));
    console.log(chalk.gray(' will be:'), chalk.white(`${save[1]}:${save[2]}`) + chalk.gray(' to ') + chalk.white(`${save[3]}:${save[4]}`));
    console.log('    ' + (this.settings.json ? ' ' : '') + chalk.white((tok ? ('' + (tok.type || 'Attr')).toUpperCase() || 'undefined' : 'undefined')));
    
    if(this.settings.show_token){
        console.log(JSON.stringify(tok, null, 4));
    }
    
    var i, t, l, j;
    var bg = 'bgGreen';
    
    for(i = save[1] - 2; i < save[3] + 3; i++){
        t = this.lines[i - 1];
        
        if(i === 1 && t.charAt(0) === '\uFEFF') t = t.substr(1);
        
        if(i > this.lines.length || i < 1){
            t = chalk.bgRed(' ');
        } else {
            if(i < save[1] || i > save[3]){
                t = chalk.gray((this.settings.json ? JSON.stringify(t) : t));
            } else {
                if(i > save[1] && i < save[3]){
                    t = chalk.white[bg]((this.settings.json ? JSON.stringify(t) : t));
                }
                else if(i === save[1] && i === save[3] && save[2] === save[4]){
                    if(save[2] < this.lines[save[1] - 1].length + 1){
                        l = '';
                        
                        j = t.substr(0, save[2] - 1);
                        if(this.settings.json){
                            j = JSON.stringify(j);
                            j = j.substr(1, j.length - 2);
                        }
                        l += chalk.gray(j);
                        
                        if(save[4] <= t.length){
                        
                            j = t.substring(save[2] - 1, save[4]);
                            if(this.settings.json){
                                j = JSON.stringify(j);
                                j = j.substr(1, j.length - 2);
                            }
                            l += chalk.grey.bgYellow(j);
                            
                            j = t.substr(save[4]);
                            if(this.settings.json){
                                j = JSON.stringify(j);
                                j = j.substr(1, j.length - 2);
                            }
                            l += chalk.gray(j);
                            
                            t = (this.settings.json ? chalk.gray('"') + l + chalk.gray('"') : l);
                            
                        } else {
                            t = (this.settings.json ? chalk.gray('"') + l + chalk.gray.bgYellow('"') : l + chalk.gray.bgYellow(' '));
                        }
                    } else {
                        if(this.settings.json){
                            l = JSON.stringify(t);
                            l = l.substr(0, l.length - 1);
                            j = '"';
                        } else {
                            l = t;
                            j = ' ';
                        }
                        t = chalk.grey(l) + chalk.grey.bgYellow(j);
                    }
                }
                else if(i === save[1] && i === save[3]){
                    l = '';
                    
                    j = t.substr(0, save[2] - 1);
                    if(this.settings.json){
                        j = JSON.stringify(j);
                        j = j.substr(1, j.length - 2);
                    }
                    l += chalk.gray(j);
                    
                    j = t.substring(save[2] - 1, save[4] - 1);
                    if(this.settings.json){
                        j = JSON.stringify(j);
                        j = j.substr(1, j.length - 2);
                    }
                    l += chalk.white[bg](j);
                    
                    j = t.substr(save[4] - 1);
                    if(this.settings.json){
                        j = JSON.stringify(j);
                        j = j.substr(1, j.length - 2);
                    }
                    l += chalk.gray(j);
                    
                    t = (this.settings.json ? chalk.gray('"') + l + chalk.gray('"') : l);
                }
                else if(i === save[1]){
                    l = '';
                    
                    j = t.substring(0, save[2] - 1);
                    if(this.settings.json){
                        j = JSON.stringify(j);
                        j = j.substr(1, j.length - 2);
                    }
                    l += chalk.gray(j);
                    
                    j = t.substr(save[2] - 1);
                    if(this.settings.json){
                        j = JSON.stringify(j);
                        j = j.substr(1, j.length - 2);
                    }
                    l += chalk.white[bg](j);
                    
                    t = (this.settings.json ? chalk.gray('"') + l + chalk.white[bg]('"') : l);
                }
                else if(i === save[3]){
                    l = '';
                    
                    j = t.substring(0, save[4] - 1);
                    if(this.settings.json){
                        j = JSON.stringify(j);
                        j = j.substr(1, j.length - 2);
                    }
                    l += chalk.white[bg](j);
                    
                    j = t.substr(save[4] - 1);
                    if(this.settings.json){
                        j = JSON.stringify(j);
                        j = j.substr(1, j.length - 2);
                    }
                    l += chalk.gray(j);
                    
                    t = (this.settings.json ? chalk.white[bg]('"') + l + chalk.gray('"') : l);
                }
            }
        }
        
        console.log((i < 10 ? (i < 0 ? '  ' + i : '   ' + i) : (i < 100 ? '  ' + i : (i < 1000 ? ' ' + i : i))) + '|', t);
    }
};

Loc.prototype.setSettings = function(settings){
    for(var setting in settings){
        this.settings[setting] = settings[setting];
    }
};

Loc.prototype.setStage = function(stage, file){
    this.stage = stage;
    this.getFiles();
    
    if(!~(this.file = this.files.indexOf(file)) && !~(this.file = this.files.indexOf(file + '.pug'))){
        if(('' + file).trim() === '' && this.files.length){
            this.file = 0;
        } else {
            return false;
        }
    }
    
    this.getNodes();
    this.pos = 0;
    this.prepToken();
    
    return true;
};

Loc.prototype.reload = function(){
    var pos = this.pos;
    this.pug = require(path.join(process.cwd(), 'packages', 'pug'));
    this.getRepoData();
    if(this.stage && this.pug_src_file) this.setStage(this.stage, this.pug_src_file);
    if((pos || 0) !== 0){
        this.pos = pos || 0;
        this.prepToken();
    }
};

module.exports = new Loc();
