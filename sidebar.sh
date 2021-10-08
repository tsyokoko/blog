#!/bin/bash

## Variable to define your Docsify ROOT dir. 
## This script is placed in [doscifyroot]/includes/Script/ in my setup and I don't have to modify the path variable even if I move the docsify folder
DOCSIFYDIR="./"

## Define where _sidebar.md is placed
OUTPUT="./_sidebar.md"

## Remove _sidebar.md before we begin
echo "Removing $OUTPUT if exists"
rm -f $OUTPUT 2> /dev/null

## Static creation of the first sidebar item (HOME)
echo "* [Home](/)" | tee -a $OUTPUT

## Function to determine the current depth and set the $tabs variable to the correct amount of spaces
function DepthTabs(){
  ## Reset tabs variable
  tabs=""

  ## Check if the amount of slashes in DEPTH variable is greater than 1
  if [ ${#DEPTH} -gt 1 ]
  then
    ## If they are, we start creating spaces in tabs variable according to the depth of the current directory/file
    for i in $(seq $((${#DEPTH}-1)))
      do
        tabs="${tabs} "
      done
  else
  ## If not we don't want any spaces
  tabs=""
  fi
}

## Function to iterate through the directory and find files and directories
## The functions takes a STRING as an optional parameter which should be the current directory to itterate through
## If no parameter is specified it defaults to $DOCSIFYDIR variable (Docsify ROOT)
function DigDeeper(){
    
CURRENTDIR=${1:-$DOCSIFYDIR}

## Find all .md files in current directory
## Exclude hidden files (.*), README.md, index.html and _sidebar.md
find "$CURRENTDIR" -maxdepth 1 -mindepth 1 -type f \( -iname "*.md" ! -iname ".*" ! -iname "README.md" ! -iname "index.html" ! -iname "_sidebar.md" \)| sort | while read filepath; do
 wholepath=$filepath
 ## Define filePath variable. This is the going to be the "relative web-path" to the file. We strip away the DOCSIFY dir from the Variable
 filePath=${wholepath//$DOCSIFYDIR/}
 ## Set DEPTH variable to ammount of slashes in current (relative) filePath
 DEPTH=${filePath//[!\/]}

 ## Define FileName variable. This is going to be what's shown in the sidebar item for the users
 ## We remove the CURRENTDIR from the fileName to just get the Name of the file.
 FileName=${wholepath/$CURRENTDIR/}
 ## Remote the slash
 FileName=${FileName/\//}
 ## Replace the underscores with spaces
 FileName=${FileName//_/ }
 ## Take away .md from the file name
 FileName=${FileName//.md/}
 
 ## URL encode spaces in filePath
 filePath=${filePath// /%20}

 ## Start the function to determine how many spaces there should be when outputing the navbar item
 DepthTabs

 ## Output the navbar item
 echo "$tabs* [$FileName]($filePath)"

 done

## Find all directories in current directory
## Exclude hidden files (.*) and the "includes" directory
find "$CURRENTDIR" -maxdepth 1 -mindepth 1 -type d \( ! -iname ".*" ! -iname "includes" \)| sort | while read filepath; do 

  ## Define folderPath variable. This is the going to be the "relative web-path" of the directory.
  ## We strip away the DOCSIFY dir from the Variable
  folderPath=${filepath//$DOCSIFYDIR/}

  ## Set DEPTH variable to ammount of slashes in current (relative) folderPath
  DEPTH=${folderPath//[!\/]}

  ## Define folderName variable. This is going to be what's shown in the sidebar item for the users.
  ## We remove every occurence of /*/ from the folderName just to get the Name of the folder (without the whole path).
  folderName=${folderPath//\/*\//}
  ## Remove the /
  folderName=${folderName//\//}
  ## Replace the underscores with spaces
  folderName=${folderName//_/ }
  
  ## URL encode spaces in folderPath
  folderPath=${folderPath// /%20}

  ## Start the function to determine how many spaces there should be when outputing the navbar item
  DepthTabs

  ## Output the navbar item. If you don't want directories with bold text, take away the stars surrounding $folderName
  ## Append a / to the folderPath output.
  echo "$tabs* [**$folderName**]($folderPath/)"

  ## Start the DigDeeper function again for each folder that's found
  DigDeeper "$filepath"

done

}

## Initiate the digging through folders and files by calling DigDepper function
DigDeeper | tee -a $OUTPUT