import arg from 'arg';
import fs from 'fs';
import readdirp from 'readdirp';
import inquirer from 'inquirer';

// Some constants for this program.
const _sidebarFile = '_sidebar.md';
const _readmeFile = 'README.md';

// Add files to filter away.
const filterFiles = ['*.md','!README.md', '!_sidebar.md', '!CHANGELOG.md', '!LICENSE.md'];

// Add directories to filter away.
const filterDirectories = ['*','!node_modules'];

// A global object to keep the cli options.
let options = {};

/**
 * This is a function to test whether the sidebar file exist.
 * @return <boolean>
 */
function sidebarFileExist() {
    return fs.existsSync(_sidebarFile);
}

/**
 * This is a function to test whether the readme file exist.
 * @return <boolean>
 */
function readmeFileExist() {
    return fs.existsSync(_readmeFile);
}

/**
 * @param str - source string to make it Title Case.
 * Make a md filename string a title case. Split case are [space] and '-' character.
 */
function toTitleCase(str) {

    // Remove .md file extension.
    // Split the string into an array.
    // Make the first character upper case.
    // Make the rest of the characters lower case.
    // Merge them back with a space in between.
    return str.replace('.md', '').split(/-| /)
        .map(w => w[0].toUpperCase() + w.substr(1).toLowerCase())
        .join(' ');
}

/**
 * This function correct all encodings in the paths so that markdown can follow and link.
 * @param str - input path in string format
 * @return {void | string | *}
 */
function corectPathEncoding(path) {

    // Use / /g global flag to replace all spaces with url encoding spaces.
   return path.replace(/ /g, '%20');
}

/**
 * This function parse the arguments and sets default values for them.
 * @param rawArgs - The arguments passed in from CLI.
 * @return {{help: (*|boolean), depth: (*|number), sort: (*|boolean), overwrite: (*|boolean)}}
 */
function parseArgumentsIntoOptions(rawArgs) {
    const args = arg(
        {
            '--help': Boolean,
            '--depth': Number,
            '--sort': Boolean,
            '--overwrite': Boolean,
            '-h': '--help',
            '-d': '--depth',
            '-s': '--sort',
            '-o': '--overwrite',
        },
        {
            argv: rawArgs.slice(2)
        }
    );
    return {
        help: args['--help'] || false,
        depth: args['--depth'] || 5,
        sort: args['--sort'] || false,
        overwrite: args['--overwrite'] || false
    };
}

/**
 * This function takes in an options object and modify the different options based on a prompt question
 * @param options - The options passed in.
 * @return {Promise<*>} {{help: (*|boolean), depth: (*|number), sort: (*|boolean), overwrite: (*|boolean)}}
 */
async function promptForMissingOptions(options) {

    options.overwrite = options.overwrite || !sidebarFileExist();

    // Early out if overwrite flag is set or the sidebar file don't exist.
    if(options.overwrite === true) {
        return options;
    }

    // Else we prompt the user.
    const questions = [];

    if (!options.overwrite) {
        questions.push({
            type: 'list',
            name: 'overwrite',
            message: 'Do you want to overwrite the ' + _sidebarFile + ' file?',
            choices: ['No', 'Yes'],
            default: 'No',
        });
    }

    // Wait for answers and set it.
    const answers = await inquirer.prompt(questions);
    options.overwrite = (answers.overwrite === 'Yes');

    return options;
}

/**
 * This function recursively parse the directories to look for files based on the 'filterFiles'.
 * @return {Promise<void>} List of files
 */
async function parseDirectoriesForMDFiles() {

    const files = await readdirp.promise(
        './', {
            fileFilter: filterFiles,
            directoryFilter: filterDirectories,
            type: 'files',
            depth: options.depth
        });

    return files;
}

/**
 * This function sort the list of markdown files based on string compare.
 * @param mdFiles
 * @return List of files sorted based on string.
 */
function sortMDFiles(mdFiles) {

    mdFiles.sort((a,b) => {

        if (a.path < b.path)
            return -1;
        if (a.path > b.path)
            return 1;
        return 0;
    });

    return mdFiles;
}

/**
 * This is the actual function to create and write to the _sidebar.md file.
 * @param mdFiles
 */
function generateSidebarFile(mdFiles) {

    let content = `<!-- docs/_sidebar.md -->\n\n`;

    // Create this if _readmeFile exist.
    if(readmeFileExist()) {
        content += `* [Home](/)\n`;
    }

    // Iterate the rest of the files.
    mdFiles.forEach(entity => {
        content += `* [` + toTitleCase(entity.basename) + `](` + corectPathEncoding(entity.path) + `)\n`;
    });

    fs.writeFile(_sidebarFile, content, 'utf8', (err) => { if (err) { return err; }});

    console.log('\nGenerated ' + _sidebarFile + ' successfully.\n');
}

/**
 * Display help when user use the -h option.
 */
function displayHelp() {

    console.log(
        `\nDefault options:\n` +
        `'depth' is 5\n` +
        `'sort' is OFF\n` +
        `'overwrite' is OFF\n` +
        `\n\nOptions: \n\n` +
        `--help, -h \t\t Display help.\n` +
        `--depth, -d [Number] \t Set the depth of the directory to recursive to find *.md files.\n` +
        `\t\t\t Depth 0 means it will NOT recurse.\n` +
        `--sort, -s \t\t Option to sort the the *.md files in alphabetical order.\n` +
        `--overwrite, -o \t If this option is set, it will overwrite the ${_sidebarFile} file if exist.` +
        `\n`
    );
}

/**
 * The main entry function for the cli.
 * @param args - This is passed through the command line.
 * @return {Promise<void>}
 */
export async function cli(args) {

    // Step 1: Parse the arguments into options.
    options = parseArgumentsIntoOptions(args);

    if(options.help === true) {

        displayHelp();

        // Early out return.
        return;
    }

    // Step 2: Fill in any missing options required using prompt.
    options = await promptForMissingOptions(options);

    if(options.overwrite === false) {

        console.log('\nMission abort.\n');

        // Whether the file exist or not, in order to proceed, we need the overwrite option to be true. Else we turn.
        return;
    }

    // Step 3: Parse the directories for *.md files.
    let mdFiles = await parseDirectoriesForMDFiles();

    // Step 4: Sort the files if required.
    // Sort is done based on directories, then file names.
    if(options.sort === true) {
        mdFiles = sortMDFiles(mdFiles);
    }

    // Step 5: Generate the _sidebar.md file.
    generateSidebarFile(mdFiles);
}