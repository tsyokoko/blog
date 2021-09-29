# sidebar-generator
This is a CLI tool to generate the _sidebar.md file for docsify directories recursively.  

To understand what is docsify, please refer to [docsify](https://docsify.js.org/#/).  
To understand why you need the sidebar-generator, please refer to [docsify sidebar](https://docsify.js.org/#/more-pages?id=sidebar).


# Installing and using

To install sidebar generator:
```
npm i @johntng/sidebar-generator
```

To uninstall:
```
npm un @johntng/sidebar-generator
```

To use the sidebar-generator, simply type in the folder you want to generate the _sidebar.md file:
```
sidebar-generator
```

If the '_sidebar.md' file already exist, you will be prompt to overwrite it:
```
? Do you want to overwrite the _sidebar.md file? (Use arrow keys)
❯ No 
  Yes 
```


# List of arguments

Run the cli with -h for more options

```
sidebar-generator -h
```

Output:
```
Options: 

Default options:
'depth' is 5
'sort' is off by default
'overwrite' is off by default

--help, -h 		 Display help.
--depth, -d [Number] 	 Set the depth of the directory to recursive to find *.md files.
			 Depth 0 means it will NOT recurse.
--sort, -s 		 Option to sort the the *.md files in alphabetical order.
--overwrite, -o 	 If this option is set, it will overwrite the _sidebar.md file if exist.
```