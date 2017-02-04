"use strict";

const chalk = require('chalk');
const clear = require('clear');
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const safeGet = require('./safe-get.js');

function Loc(){
    this.stage = 'lexer';
    this.file = '';
    this.pug = undefined;
    
    this.plugin = {
        postLex: tokens => this.lexer_tokens = tokens,
        postParse: ast => this.parser_ast = ast
    };
    
    this.settings = {};
    
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
    const dir = path.join(process.cwd(), 'packages');
    
    switch(this.stage){
        case 'lexer':
        case 'parser': 
            this.pug_src_dir = path.join(dir, 'pug-lexer', 'test', 'cases');
            break;
        default: throw new Error('implement');
    }
    
    this.pug_src_file = this.file;
    this.pug_src = fs.readFileSync(path.join(this.pug_src_dir, this.pug_src_file), 'utf8');
    this.lines = this.pug_src.split(/(?:\r\n|\n|\r)/g);
    
    this.rendered = this.pug.render(this.pug_src, { plugins: [this.plugin], filename:this.pug_src_file });
    
    switch(this.stage){
        case 'lexer': this.getLexerLocs(); break;
        case 'parser': this.getParserLocs(); break;
        default: throw new Error('implement');
    }
};

Loc.prototype.getRepoData = function(){
    this.repo = undefined;
    var repo;
    var branch;
    
    var done = () => {
        if(repo === undefined || branch === undefined) return;
        
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
        
        try {
            fs.mkdirSync(path.join(__dirname, '..', 'save', this.repo.dir));
        } catch(err){}
    
        try {
            fs.mkdirSync(path.join(__dirname, '..', 'save', this.repo.dir, this.repo.branch));
        } catch(err){}
    };
    
    exec('git config --get remote.origin.url', function(err, stdout, stderr){
        repo = stdout.replace(/[\r\n \t]+/g, '');
        done();
    });
    
    exec('git rev-parse --abbrev-ref HEAD', function(err, stdout, stderr){
        branch = stdout.replace(/[\r\n \t]+/g, '');
        done();
    });
};

Loc.prototype.nextToken = function(){
    this.pos++;
    
    if(this.pos >= this.locs.length){
        process.nextTick(() => this.nextFile());
        return;
    }
    
    this.prepToken();
};

Loc.prototype.prepToken = function(){
    while(this.pos >= this.locs.length){
        this.pos--;
    }
    
    const a = this.locs[this.pos];
    const e = (this.locs_expected && this.locs_expected.length > this.pos ? this.locs_expected[this.pos] : ['??', -1, -1, -1 , -1]);
    
    var match = a[0] === e[0] && a[1] === e[1] && a[2] === e[2] && a[3] === e[3] && a[4] === e[4];
    var use_actual = e[3] === -1 || e[4] === -1 || e[1] === -1 || e[0] === -1;
    var save = [a[0], a[1], a[2], a[3], a[4]];
    
    this.fixEndpoints((use_actual ? a : e), save);
    
    if(match && this.settings.run && this.settings.pause !== this.pos){
        this.settings.pause = -1;
        process.nextTick(() => this.nextToken());
        return;
    }
    
    this.match = match;
    this.actual = a;
    this.expected = e;
    this.save = save;
    
    if(this.settings.run){
        this.settings.pause = this.pos;
    }
};

Loc.prototype.screen = function(){
    
    if(this.pos >= this.locs.length){
        process.nextTick(() => this.nextFile());
        return;
    }
    
    clear();
    
    const tok = this.tokens[this.pos];
    const match = this.match;
    const a = this.actual;
    const e = this.expected;
    const save = this.save;
    
    console.log(chalk[match ? 'green' : 'red'](this.file.replace(/\.pug$/, '')), chalk.gray('@'), chalk.white(this.pos + 1));
    console.log(chalk.gray('  actual:'), chalk.white(`${a[1]}:${a[2]}`) + chalk.gray(' to ') + chalk.white(`${a[3]}:${a[4]}`));
    console.log(chalk.gray('expected:'), chalk.white(`${e[1] === -1 ? '??' : e[1]}:${e[2] === -1 ? '??' : e[2]}`) + chalk.gray(' to ') + chalk.white(`${e[3] === -1 ? '??' : e[3]}:${e[4] === -1 ? '??' : e[4]}`));
    console.log(chalk.gray(' will be:'), chalk.white(`${save[1]}:${save[2]}`) + chalk.gray(' to ') + chalk.white(`${save[3]}:${save[4]}`));
    console.log('    ' + (this.settings.json ? ' ' : '') + chalk.white((tok ? ('' + tok.type).toUpperCase() || 'undefined' : 'undefined')));
    
    if(this.settings.show_token){
        console.log(JSON.stringify(tok, null, 4));
    }
    
    var i, t, l, j;
    var bg = 'bgGreen';
    
    for(i = save[1] - 2; i < save[3] + 3; i++){
        t = this.lines[i - 1];
        
        if(i === 1 && t.charAt(0) === '\uFEFF') t = t.substr(1);
        
        if(i > this.pug_src.length || i < 1){
            t = chalk.bgRed(' ');
        } else {
            if(i < save[1] || i > save[3]){
                t = chalk.gray((this.settings.json ? JSON.stringify(t) : t));
            } else {
                if(i > save[1] && i < save[3]){
                    t = chalk.white[bg]((this.settings.json ? JSON.stringify(t) : t));
                }
                else if(i === save[1] && i === save[3] && save[2] === save[4]){
                    if(save[2] < this.pug_src[save[1] - 1].length + 1){
                        l = '';
                        
                        j = t.substr(0, save[2] - 1);
                        if(this.settings.json){
                            j = JSON.stringify(j);
                            j = j.substr(1, j.length - 2);
                        }
                        l += chalk.gray(j);
                        
                        j = t.substring(save[2] - 1, save[4]);
                        if(this.settings.json){
                            j = JSON.stringify(j);
                            j = j.substr(1, j.length - 2);
                        }
                        l += chalk.grey[bg](j);
                        
                        j = t.substr(save[4]);
                        if(this.settings.json){
                            j = JSON.stringify(j);
                            j = j.substr(1, j.length - 2);
                        }
                        l += chalk.gray(j);
                        
                        t = (this.settings.json ? chalk.gray('"') + l + chalk.gray('"') : l);
                    } else {
                        if(this.settings.json){
                            l = JSON.stringify(t);
                            l = l.substr(0, l.length - 1);
                            j = '"';
                        } else {
                            l = t;
                            j = ' ';
                        }
                        t = chalk.grey(l) + chalk.grey[bg](j);
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

Loc.prototype.setStage = function(stage, file){
    this.stage = stage;
    this.file = file;
    
    this.getNodes();
    this.pos = 0;
    this.prepToken();
};

Loc.prototype.reload = function(){
    this.pug = require(path.join(process.cwd(), 'packages', 'pug'));
    if(this.file) this.getNodes();
    this.getRepoData();
};

module.exports = new Loc();
