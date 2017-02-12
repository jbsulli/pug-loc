# pug-loc-debugger
Use this tool to visualize and debug `loc` properties on [Pug](https://pugjs.org/api/getting-started.html) tokens/nodes.

This tool relies on Pug's plugin system to grab tokens/nodes at each stage of the Pug compiler. 

## Install

`npm install -g pug-loc-debugger`

## Running

To run, simply `cd` to a Pug directory and run `pug-loc-debugger`. It should prompt you for a stage and a file. For the file input, hit enter to use the first file in the cases directory. Otherwise type in the file name you wish to jump to (`.pug` extension is optional).

## Keys

I wanted to be able to quickly jump around so I designed the program to take single key input. After picking a stage and file, you should be presented with a screen showing the current token highlighted in the Pug source file. Use the following keys to work with the tokens:

### Navigation
```
c) Next file
z) Previous file
s) Next token
w) Previous token
r) Run until a token does not match it's expected location value
```

### Modes
```
j) Toggle JSON mode (default). When on, the line will be JSON.stringified() to better show what is going on with the whitespace (tabs at the start of the line as well as whitespace at the end of the line can be quite confusing otherwise).
```

### Debugging
```
q) Move expected location start left one character
e) Move expected location start right one character
a) Move expected location end left one character
d) Move expected location end right one character
spacebar) Save the expected location of this token to disk
```

## Save location
Hitting the spacebar will save the expected location to a file in the pug-loc-debugger install directory. If you used the `-g` flag, you can get the install folder by running `npm config get prefix` then going to `node_modules/pug-loc-debugger/save` to see the save folders.

This tool was designed to work with different repos/branches so the save location will look like:
```
save/jbsulli-pug/source-end-locations/parser
```
Where `jbsulli` is the GitHub user/organization, `pug` is the repo, `source-end-locations` is the branch, and `parser` is the stage. From there you should see files matching the Pug file you were debugging. If you don't see a file in there, you probably haven't saved any token locations for that file yet.
